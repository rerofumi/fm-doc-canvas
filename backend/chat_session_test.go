package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestChatSessionServiceSeparatesCanvases(t *testing.T) {
	service := newChatSessionService(filepath.Join(t.TempDir(), "chat-sessions.json"))
	first := []ChatSession{{ID: "first", Title: "First"}}
	if err := service.Save("canvas-a", first); err != nil {
		t.Fatal(err)
	}
	if err := service.Save("canvas-b", []ChatSession{{ID: "second", Title: "Second"}}); err != nil {
		t.Fatal(err)
	}
	loaded, err := service.Load("canvas-a")
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded) != 1 || loaded[0].ID != "first" {
		t.Fatalf("unexpected sessions: %#v", loaded)
	}
}

func TestChatSessionServiceWritesCanvasSessionWrapper(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	service := newChatSessionService(path)
	if err := service.Save("canvas-a", []ChatSession{{ID: "first", Title: "First"}}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Canvases map[string]struct {
			Sessions []ChatSession `json:"sessions"`
		} `json:"canvases"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Canvases["canvas-a"].Sessions) != 1 {
		t.Fatalf("unexpected persisted shape: %s", data)
	}
}

func TestChatSessionServiceReadsTemporaryArrayFormat(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	legacy := `{"version":1,"canvases":{"canvas-a":[{"id":"legacy","title":"Legacy","createdAt":0,"updatedAt":0,"messages":[]}]}}`
	if err := os.WriteFile(path, []byte(legacy), 0644); err != nil {
		t.Fatal(err)
	}
	service := newChatSessionService(path)
	sessions, err := service.Load("canvas-a")
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 || sessions[0].ID != "legacy" {
		t.Fatalf("unexpected migrated sessions: %#v", sessions)
	}
}

func TestChatSessionServiceReturnsEmptySliceForUnknownCanvas(t *testing.T) {
	service := newChatSessionService(filepath.Join(t.TempDir(), "chat-sessions.json"))
	sessions, err := service.Load("unknown-canvas")
	if err != nil {
		t.Fatal(err)
	}
	if sessions == nil || len(sessions) != 0 {
		t.Fatalf("expected a non-nil empty slice, got %#v", sessions)
	}
}

func TestChatSessionServiceDoesNotOverwriteMalformedJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	if err := os.WriteFile(path, []byte("{"), 0644); err != nil {
		t.Fatal(err)
	}
	service := newChatSessionService(path)
	if err := service.Save("canvas-a", nil); err == nil {
		t.Fatal("expected malformed JSON error")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "{" {
		t.Fatalf("malformed file was overwritten: %q", data)
	}
}
