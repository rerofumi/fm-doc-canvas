package backend

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// GeneratedImagePayload holds the raw image output from an image generation provider.
type GeneratedImagePayload struct {
	DataURL  string
	ImageURL string
}

// ImageAssetService manages image storage, path validation, and URL/DataURL resolution.
type ImageAssetService struct {
	cfgService *ConfigService
	httpClient *http.Client
}

// NewImageAssetService creates an ImageAssetService with the given ConfigService and HTTP client.
func NewImageAssetService(cfgService *ConfigService, httpClient *http.Client) *ImageAssetService {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &ImageAssetService{
		cfgService: cfgService,
		httpClient: httpClient,
	}
}

// ResolveDownloadRoot resolves the effective download root directory according to [D-005].
func ResolveDownloadRoot(downloadPath string) (string, error) {
	p := strings.TrimSpace(downloadPath)
	if p == "" {
		p = "Image/"
	}
	if filepath.IsAbs(p) {
		return filepath.Clean(p), nil
	}

	baseDir := strings.TrimSpace(os.Getenv("FM_DOC_CANVAS_BASE_DIR"))
	if baseDir == "" {
		var err error
		baseDir, err = defaultBaseDir()
		if err != nil {
			return "", fmt.Errorf("failed to resolve base directory: %w", err)
		}
	}
	return filepath.Clean(filepath.Join(baseDir, p)), nil
}

// DownloadRoot returns the resolved download directory from ConfigService.
func (s *ImageAssetService) DownloadRoot() (string, error) {
	cfg, err := s.cfgService.GetConfig()
	if err != nil {
		return "", err
	}
	return ResolveDownloadRoot(cfg.ImageGen.DownloadPath)
}

// ResolveImagePath validates src against path traversal and resolves it within DownloadRoot.
func (s *ImageAssetService) ResolveImagePath(src string) (string, error) {
	root, err := s.DownloadRoot()
	if err != nil {
		return "", err
	}
	return resolveImagePathWithinRoot(root, src)
}

func resolveImagePathWithinRoot(downloadRoot, src string) (string, error) {
	trimmed := strings.TrimSpace(src)
	if trimmed == "" {
		return "", errors.New("image path is empty")
	}

	// Reject absolute paths, leading slashes/backslashes, and Windows drive letters.
	if filepath.IsAbs(trimmed) ||
		strings.HasPrefix(trimmed, "/") ||
		strings.HasPrefix(trimmed, `\`) ||
		filepath.VolumeName(trimmed) != "" ||
		(len(trimmed) >= 2 && trimmed[1] == ':') {
		return "", fmt.Errorf("invalid image path (absolute path rejected): %s", src)
	}

	normalized := strings.ReplaceAll(trimmed, `\`, "/")
	for _, seg := range strings.Split(normalized, "/") {
		if seg == ".." {
			return "", fmt.Errorf("invalid image path (path traversal rejected): %s", src)
		}
	}

	absRoot, err := filepath.Abs(downloadRoot)
	if err != nil {
		return "", fmt.Errorf("failed to resolve download root: %w", err)
	}
	absResolved, err := filepath.Abs(filepath.Join(absRoot, filepath.FromSlash(normalized)))
	if err != nil {
		return "", fmt.Errorf("failed to resolve image path: %w", err)
	}

	rel, err := filepath.Rel(absRoot, absResolved)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid image path (escapes download root): %s", src)
	}

	if evalRoot, errRoot := filepath.EvalSymlinks(absRoot); errRoot == nil {
		if evalResolved, errRes := filepath.EvalSymlinks(absResolved); errRes == nil {
			evalRel, errRel := filepath.Rel(evalRoot, evalResolved)
			if errRel != nil || evalRel == ".." || strings.HasPrefix(evalRel, ".."+string(filepath.Separator)) {
				return "", fmt.Errorf("invalid image path (symlink escapes download root): %s", src)
			}
		}
	}

	return absResolved, nil
}

// SaveGeneratedImage decodes a DataURL or downloads an ImageURL and writes it with collision-safe naming.
// It returns the relative path from DownloadRoot using forward slashes.
func (s *ImageAssetService) SaveGeneratedImage(payload GeneratedImagePayload) (string, error) {
	var (
		data []byte
		ext  string
		err  error
	)

	switch {
	case strings.TrimSpace(payload.DataURL) != "":
		data, ext, err = decodeImageDataURL(payload.DataURL)
	case strings.TrimSpace(payload.ImageURL) != "":
		data, ext, err = s.downloadImageURL(payload.ImageURL)
	default:
		return "", errors.New("generated image payload is empty")
	}
	if err != nil {
		return "", err
	}

	root, err := s.DownloadRoot()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return "", fmt.Errorf("failed to create download directory: %w", err)
	}

	filename, fullPath, err := generateUniqueFilename(root, "image", "."+ext)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(fullPath, data, 0o644); err != nil {
		return "", fmt.Errorf("failed to write image file: %w", err)
	}

	return filepath.ToSlash(filename), nil
}

// GetImageDataURL reads a validated image asset and returns it as a base64 Data URL.
func (s *ImageAssetService) GetImageDataURL(src string) (string, error) {
	absPath, err := s.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return "", fmt.Errorf("failed to read image file %q: %w", src, err)
	}

	mimeType := detectImageMIME(absPath, data)
	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

// GetImageFileURL validates src, verifies the file exists, and returns an absolute file:/// URL.
func (s *ImageAssetService) GetImageFileURL(src string) (string, error) {
	absPath, err := s.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(absPath); err != nil {
		return "", fmt.Errorf("image file not accessible %q: %w", src, err)
	}

	slashPath := filepath.ToSlash(absPath)
	if !strings.HasPrefix(slashPath, "/") {
		slashPath = "/" + slashPath
	}
	u := url.URL{
		Scheme: "file",
		Path:   slashPath,
	}
	return u.String(), nil
}

func decodeImageDataURL(dataURL string) ([]byte, string, error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return nil, "", errors.New("invalid data URL: missing data: prefix")
	}
	commaIdx := strings.IndexByte(dataURL, ',')
	if commaIdx < 0 {
		return nil, "", errors.New("invalid data URL: missing comma separator")
	}

	header := dataURL[len("data:"):commaIdx]
	body := dataURL[commaIdx+1:]
	if !strings.Contains(header, ";base64") {
		return nil, "", errors.New("invalid data URL: expected base64 encoding")
	}

	mimePart := strings.SplitN(header, ";", 2)[0]
	ext := extFromMIME(mimePart)

	decoded, err := base64.StdEncoding.DecodeString(body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode base64 image data: %w", err)
	}
	if len(decoded) == 0 {
		return nil, "", errors.New("decoded image data is empty")
	}
	return decoded, ext, nil
}

func (s *ImageAssetService) downloadImageURL(rawURL string) ([]byte, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, "", fmt.Errorf("invalid image URL: %w", err)
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, "", fmt.Errorf("unsupported image URL scheme: %s", parsed.Scheme)
	}

	req, err := http.NewRequest(http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create image download request: %w", err)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("image download returned HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read downloaded image body: %w", err)
	}
	if len(data) == 0 {
		return nil, "", errors.New("downloaded image body is empty")
	}

	ct := strings.TrimSpace(strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0])
	if ct == "" || !strings.HasPrefix(strings.ToLower(ct), "image/") {
		detected := http.DetectContentType(data)
		if !strings.HasPrefix(detected, "image/") {
			return nil, "", fmt.Errorf("downloaded content is not an image (Content-Type=%q)", resp.Header.Get("Content-Type"))
		}
		ct = detected
	}

	return data, extFromMIME(ct), nil
}

func extFromMIME(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/jpg":
		return "jpg"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	case "image/png":
		return "png"
	default:
		return "png"
	}
}

func detectImageMIME(path string, data []byte) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	}
	if m := mime.TypeByExtension(ext); m != "" {
		return m
	}
	return http.DetectContentType(data)
}

func generateUniqueFilename(dir, prefix, ext string) (string, string, error) {
	const maxAttempts = 10
	ts := time.Now().Format("20060102_150405")

	for i := 0; i < maxAttempts; i++ {
		var rnd [2]byte
		if _, err := rand.Read(rnd[:]); err != nil {
			return "", "", fmt.Errorf("failed to generate random suffix: %w", err)
		}
		name := fmt.Sprintf("%s_%s_%s%s", prefix, ts, hex.EncodeToString(rnd[:]), ext)
		full := filepath.Join(dir, name)
		if _, err := os.Stat(full); os.IsNotExist(err) {
			return name, full, nil
		}
	}
	return "", "", errors.New("failed to allocate unique image filename after 10 attempts")
}
