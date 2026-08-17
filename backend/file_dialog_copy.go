package backend

import "fmt"

type fileDialogKind string

const (
	fileDialogSaveCanvas     fileDialogKind = "save-canvas"
	fileDialogOpenCanvas     fileDialogKind = "open-canvas"
	fileDialogExportMarkdown fileDialogKind = "export-markdown"
	fileDialogExportImage    fileDialogKind = "export-image"
)

type dialogCopyValue struct {
	Title       string
	DisplayName string
}

func normalizeDialogLocale(locale string) string {
	if locale == "ja" {
		return "ja"
	}
	return "en"
}

func fileDialogCopy(kind fileDialogKind, locale, ext string) dialogCopyValue {
	if normalizeDialogLocale(locale) == "ja" {
		switch kind {
		case fileDialogSaveCanvas:
			return dialogCopyValue{Title: "Canvas を保存", DisplayName: "JSON ファイル (*.json)"}
		case fileDialogOpenCanvas:
			return dialogCopyValue{Title: "Canvas を開く", DisplayName: "JSON ファイル (*.json)"}
		case fileDialogExportMarkdown:
			return dialogCopyValue{Title: "Markdown をエクスポート", DisplayName: "Markdown ファイル (*.md)"}
		case fileDialogExportImage:
			return dialogCopyValue{Title: "画像をエクスポート", DisplayName: fmt.Sprintf("画像ファイル (*%s)", ext)}
		}
	}
	switch kind {
	case fileDialogSaveCanvas:
		return dialogCopyValue{Title: "Save Canvas", DisplayName: "JSON Files (*.json)"}
	case fileDialogOpenCanvas:
		return dialogCopyValue{Title: "Open Canvas", DisplayName: "JSON Files (*.json)"}
	case fileDialogExportMarkdown:
		return dialogCopyValue{Title: "Export Markdown", DisplayName: "Markdown Files (*.md)"}
	case fileDialogExportImage:
		return dialogCopyValue{Title: "Export Image", DisplayName: fmt.Sprintf("Image Files (*%s)", ext)}
	default:
		return dialogCopyValue{}
	}
}
