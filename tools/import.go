package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// キャラクター構造体
type Character struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	ImagePath       string `json:"image_path"`
	DefaultPosition string `json:"default_position"`
}

// シナリオ構造体
type Scenario struct {
	SceneID     string   `json:"scene_id"`
	Order       int      `json:"order"`
	Type        string   `json:"type"`
	CharacterID string   `json:"character_id"`
	Text        string   `json:"text"`
	Position    string   `json:"position"`
	Effect      string   `json:"effect"`
	Background  string   `json:"background"`
	NextScene   string   `json:"next_scene"`
	Choices     []Choice `json:"choices,omitempty"`
}

// 選択肢構造体
type Choice struct {
	Text      string `json:"text"`
	NextScene string `json:"next_scene"`
}

func main() {
	// 環境変数から設定を取得
	spreadsheetID := os.Getenv("SPREADSHEET_ID")
	credentialsPath := os.Getenv("GOOGLE_CREDENTIALS_PATH")

	if spreadsheetID == "" {
		log.Fatal("SPREADSHEET_ID 環境変数が設定されていません")
	}
	if credentialsPath == "" {
		credentialsPath = "credentials.json" // デフォルトパス
	}

	// Google Sheets APIクライアントの初期化
	ctx := context.Background()
	srv, err := sheets.NewService(ctx, option.WithCredentialsFile(credentialsPath))
	if err != nil {
		log.Fatalf("Sheets APIクライアントの作成に失敗: %v", err)
	}

	// キャラクターデータの読み込み
	characters, err := readCharacters(srv, spreadsheetID)
	if err != nil {
		log.Fatalf("キャラクターデータの読み込みに失敗: %v", err)
	}

	// シナリオデータの読み込み
	scenarios, err := readScenarios(srv, spreadsheetID)
	if err != nil {
		log.Fatalf("シナリオデータの読み込みに失敗: %v", err)
	}

	// 選択肢データの読み込みとマージ
	choices, err := readChoices(srv, spreadsheetID)
	if err != nil {
		log.Fatalf("選択肢データの読み込みに失敗: %v", err)
	}

	// シナリオに選択肢をマージ
	scenarios = mergeChoices(scenarios, choices)

	// JSONファイルとして出力
	if err := saveCharactersJSON(characters); err != nil {
		log.Fatalf("キャラクターJSONの保存に失敗: %v", err)
	}

	if err := saveScenariosJSON(scenarios); err != nil {
		log.Fatalf("シナリオJSONの保存に失敗: %v", err)
	}

	fmt.Println("✓ データのインポートが完了しました")
	fmt.Printf("  - キャラクター: %d件\n", len(characters))
	fmt.Printf("  - シナリオ: %d件\n", len(scenarios))
}

// キャラクターシートを読み込む
func readCharacters(srv *sheets.Service, spreadsheetID string) (map[string]Character, error) {
	readRange := "characters!A2:D" // ヘッダー行を除く
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("キャラクターシートの読み込みエラー: %v", err)
	}

	characters := make(map[string]Character)
	for _, row := range resp.Values {
		if len(row) < 4 {
			continue
		}

		id := toString(row[0])
		char := Character{
			ID:              id,
			Name:            toString(row[1]),
			ImagePath:       toString(row[2]),
			DefaultPosition: toString(row[3]),
		}
		characters[id] = char
	}

	return characters, nil
}

// シナリオシートを読み込む
func readScenarios(srv *sheets.Service, spreadsheetID string) ([]Scenario, error) {
	readRange := "scenarios!A2:I" // ヘッダー行を除く
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("シナリオシートの読み込みエラー: %v", err)
	}

	var scenarios []Scenario
	for _, row := range resp.Values {
		if len(row) < 9 {
			continue
		}

		order, _ := strconv.Atoi(toString(row[1]))
		scenario := Scenario{
			SceneID:     toString(row[0]),
			Order:       order,
			Type:        toString(row[2]),
			CharacterID: toString(row[3]),
			Text:        toString(row[4]),
			Position:    toString(row[5]),
			Effect:      toString(row[6]),
			Background:  toString(row[7]),
			NextScene:   toString(row[8]),
		}
		scenarios = append(scenarios, scenario)
	}

	return scenarios, nil
}

// 選択肢シートを読み込む
func readChoices(srv *sheets.Service, spreadsheetID string) (map[string][]Choice, error) {
	readRange := "choices!A2:C" // ヘッダー行を除く
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("選択肢シートの読み込みエラー: %v", err)
	}

	choices := make(map[string][]Choice)
	for _, row := range resp.Values {
		if len(row) < 3 {
			continue
		}

		sceneID := toString(row[0])
		choice := Choice{
			Text:      toString(row[1]),
			NextScene: toString(row[2]),
		}
		choices[sceneID] = append(choices[sceneID], choice)
	}

	return choices, nil
}

// シナリオに選択肢をマージ
func mergeChoices(scenarios []Scenario, choices map[string][]Choice) []Scenario {
	for i, scenario := range scenarios {
		if scenario.Type == "choice" {
			if ch, exists := choices[scenario.SceneID]; exists {
				scenarios[i].Choices = ch
			}
		}
	}
	return scenarios
}

// キャラクターJSONを保存
func saveCharactersJSON(characters map[string]Character) error {
	data, err := json.MarshalIndent(characters, "", "  ")
	if err != nil {
		return err
	}

	outputPath := "../data/characters.json"
	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return err
	}

	fmt.Printf("✓ %s を保存しました\n", outputPath)
	return nil
}

// シナリオJSONを保存
func saveScenariosJSON(scenarios []Scenario) error {
	data, err := json.MarshalIndent(scenarios, "", "  ")
	if err != nil {
		return err
	}

	outputPath := "../data/scenario.json"
	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return err
	}

	fmt.Printf("✓ %s を保存しました\n", outputPath)
	return nil
}

// interface{}をstringに変換
func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}
