package backend

import (
"fmt"
"path/filepath"
"strings"
)

// NewConfigServiceFromStore wraps a ConfigStore as *ConfigService without touching the OS user config dir.
func NewConfigServiceFromStore(store ConfigStore) *ConfigService {
cfg := store.GetConfig()
copy := cfg
return &ConfigService{
config:     &copy,
configPath: "",
store:      store,
}
}

// TempAssetStore is a minimal AssetStore rooted at an E2E temp directory.
type TempAssetStore struct {
Root string
FS   FileSystemPort
}

func (a TempAssetStore) ResolveImagePath(src string) (string, error) {
if filepath.IsAbs(src) || strings.Contains(src, "..") {
return "", fmt.Errorf("invalid image path")
}
return filepath.Join(a.Root, "Image", filepath.FromSlash(src)), nil
}

func (a TempAssetStore) GetImageDataURL(string) (string, error) {
return "", fmt.Errorf("image data url not available in e2e fixture")
}

func (a TempAssetStore) GetImageFileURL(src string) (string, error) {
p, err := a.ResolveImagePath(src)
if err != nil {
return "", err
}
return "file:///" + filepath.ToSlash(p), nil
}

func (a TempAssetStore) ImportImage(srcPath string) (string, error) {
base := filepath.Base(srcPath)
rel := filepath.ToSlash(filepath.Join("Import", base))
dst := filepath.Join(a.Root, "Image", "Import", base)
if err := a.FS.CopyFile(srcPath, dst); err != nil {
return "", err
}
return rel, nil
}

func (a TempAssetStore) ExportImage(src, destPath string) error {
p, err := a.ResolveImagePath(src)
if err != nil {
return err
}
return a.FS.CopyFile(p, destPath)
}
