package backend

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
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

func TestChatSessionServiceConcurrentCanvasWritesRemainIsolated(t *testing.T) {
	service := newChatSessionService(filepath.Join(t.TempDir(), "chat-sessions.json"))
	var wg sync.WaitGroup
	for i, canvasID := range []string{"canvas-a", "canvas-b"} {
		wg.Add(1)
		go func(index int, id string) {
			defer wg.Done()
			for version := 0; version < 8; version++ {
				if err := service.Save(id, []ChatSession{{ID: id, Title: string(rune('A' + index)), UpdatedAt: int64(version)}}); err != nil {
					t.Errorf("save %s v%d: %v", id, version, err)
				}
			}
		}(i, canvasID)
	}
	wg.Wait()
	for _, canvasID := range []string{"canvas-a", "canvas-b"} {
		loaded, err := service.Load(canvasID)
		if err != nil {
			t.Fatal(err)
		}
		if len(loaded) != 1 || loaded[0].ID != canvasID {
			t.Fatalf("concurrent save corrupted %s: %#v", canvasID, loaded)
		}
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
	if file.Canvases["canvas-a"].Sessions[0].IsDefaultTitle {
		t.Fatal("user-defined title was persisted as default")
	}
	if !bytes.Contains(data, []byte(`"isDefaultTitle"`)) {
		t.Fatalf("marker is missing from persisted content: %s", data)
	}
}

func TestChatSessionServiceMigratesLegacyDefaultMarkerSafely(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	legacy := `{"version":1,"canvases":{"canvas-a":{"sessions":[{"id":"new","title":"新しい会話","createdAt":0,"updatedAt":0,"messages":[]},{"id":"custom","title":"調査 について","createdAt":0,"updatedAt":0,"messages":[]}]}}}`
	if err := os.WriteFile(path, []byte(legacy), 0644); err != nil {
		t.Fatal(err)
	}
	service := newChatSessionService(path)
	sessions, err := service.Load("canvas-a")
	if err != nil {
		t.Fatal(err)
	}
	if !sessions[0].IsDefaultTitle || sessions[1].IsDefaultTitle {
		t.Fatalf("unsafe legacy migration: %#v", sessions)
	}
	if err := service.Save("canvas-a", sessions); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(data, []byte(`"isDefaultTitle": true`)) || !bytes.Contains(data, []byte(`"isDefaultTitle": false`)) {
		t.Fatalf("migrated marker not persisted for both sessions: %s", data)
	}
}

func TestChatSessionServicePreservesExplicitFalseForGenericTitle(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	service := newChatSessionService(path)
	if err := service.Save("canvas-a", []ChatSession{{ID: "custom", Title: "新しい会話", IsDefaultTitle: false}}); err != nil {
		t.Fatal(err)
	}
	sessions, err := service.Load("canvas-a")
	if err != nil {
		t.Fatal(err)
	}
	if sessions[0].IsDefaultTitle {
		t.Fatal("explicit marker=false was inferred as default")
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

func TestChatSessionServiceDoesNotOverwriteFutureVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	original := `{"version":99,"canvases":{}}`
	if err := os.WriteFile(path, []byte(original), 0644); err != nil {
		t.Fatal(err)
	}
	service := newChatSessionService(path)
	if err := service.Save("canvas-a", nil); err == nil {
		t.Fatal("expected future version error")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != original {
		t.Fatalf("future-version file was overwritten: %q", data)
	}
}

func TestChatSessionServiceDoesNotOverwriteUnknownFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "chat-sessions.json")
	original := `{"version":1,"canvases":{},"futureField":true}`
	if err := os.WriteFile(path, []byte(original), 0644); err != nil {
		t.Fatal(err)
	}
	service := newChatSessionService(path)
	if err := service.Save("canvas-a", nil); err == nil {
		t.Fatal("expected unknown field error")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != original {
		t.Fatalf("unknown-field file was overwritten: %q", data)
	}
}
