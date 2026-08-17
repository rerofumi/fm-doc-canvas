package backend

import "testing"

func TestNormalizeDialogLocale(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"ja", "ja"}, {"en", "en"}, {"", "en"}, {"fr", "en"}, {"JA", "en"},
	} {
		if got := normalizeDialogLocale(tc.input); got != tc.want {
			t.Fatalf("normalizeDialogLocale(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestDialogCopyJapaneseEnglishAndFallback(t *testing.T) {
	tests := []struct {
		kind     fileDialogKind
		ext      string
		jaTitle  string
		enTitle  string
		jaFilter string
		enFilter string
	}{
		{fileDialogSaveCanvas, "", "Canvas を保存", "Save Canvas", "JSON ファイル (*.json)", "JSON Files (*.json)"},
		{fileDialogOpenCanvas, "", "Canvas を開く", "Open Canvas", "JSON ファイル (*.json)", "JSON Files (*.json)"},
		{fileDialogExportMarkdown, "", "Markdown をエクスポート", "Export Markdown", "Markdown ファイル (*.md)", "Markdown Files (*.md)"},
		{fileDialogExportImage, ".png", "画像をエクスポート", "Export Image", "画像ファイル (*.png)", "Image Files (*.png)"},
	}
	for _, tc := range tests {
		ja := fileDialogCopy(tc.kind, "ja", tc.ext)
		if ja.Title != tc.jaTitle || ja.DisplayName != tc.jaFilter {
			t.Errorf("ja %s = %#v", tc.kind, ja)
		}
		en := fileDialogCopy(tc.kind, "en", tc.ext)
		if en.Title != tc.enTitle || en.DisplayName != tc.enFilter {
			t.Errorf("en %s = %#v", tc.kind, en)
		}
		fallback := fileDialogCopy(tc.kind, "invalid", tc.ext)
		if fallback != en {
			t.Errorf("invalid locale %s = %#v, want %#v", tc.kind, fallback, en)
		}
	}
}
