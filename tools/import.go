package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// キャラクター構造体
type Character struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ImagePath string `json:"image_path"`
}

// シナリオ構造体
type Scenario struct {
	SceneID     string   `json:"scene_id"`
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

// タイトル構造体
type Title struct {
	Title      string `json:"title"`
	Background string `json:"background"`
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

	// タイトルデータの読み込み
	title, err := readTitle(srv, spreadsheetID)
	if err != nil {
		log.Printf("警告: タイトルデータの読み込みに失敗（スキップ）: %v", err)
		// タイトルはオプションなので、エラーでも続行
	}

	// JSONファイルとして出力
	if err := saveCharactersJSON(characters); err != nil {
		log.Fatalf("キャラクターJSONの保存に失敗: %v", err)
	}

	if err := saveScenariosJSON(scenarios); err != nil {
		log.Fatalf("シナリオJSONの保存に失敗: %v", err)
	}

	if title != nil {
		if err := saveTitleJSON(*title); err != nil {
			log.Fatalf("タイトルJSONの保存に失敗: %v", err)
		}
	}

	fmt.Println("✓ データのインポートが完了しました")
	fmt.Printf("  - キャラクター: %d件\n", len(characters))
	fmt.Printf("  - シナリオ: %d件\n", len(scenarios))
	if title != nil {
		fmt.Printf("  - タイトル: %s\n", title.Title)
	}
}

// キャラクターシートを読み込む
func readCharacters(srv *sheets.Service, spreadsheetID string) (map[string]Character, error) {
	readRange := "characters!A2:C" // ヘッダー行を除く
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("キャラクターシートの読み込みエラー: %v", err)
	}

	characters := make(map[string]Character)
	for _, row := range resp.Values {
		if len(row) < 3 {
			continue
		}

		id := toString(row[0])
		char := Character{
			ID:        id,
			Name:      toString(row[1]),
			ImagePath: toString(row[2]),
		}
		characters[id] = char
	}

	return characters, nil
}

// シナリオシートを読み込む
func readScenarios(srv *sheets.Service, spreadsheetID string) ([]Scenario, error) {
	readRange := "scenarios!A2:H" // ヘッダー行を除く（orderカラムを削除）
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("シナリオシートの読み込みエラー: %v", err)
	}

	var scenarios []Scenario
	for _, row := range resp.Values {
		// typeカラムが空欄の場合はスキップ
		if toString(row[1]) == "" {
			continue
		}

		filledRow := fillHyphenIfEmpty(row, 8)

		scenario := Scenario{
			SceneID:     filledRow[0],
			Type:        filledRow[1],
			CharacterID: filledRow[2],
			Text:        filledRow[3],
			Position:    filledRow[4],
			Effect:      filledRow[5],
			Background:  filledRow[6],
			NextScene:   filledRow[7],
		}
		scenarios = append(scenarios, scenario)
	}

	return scenarios, nil
}

// 空欄だった場合に"-"を補完する関数
func fillHyphenIfEmpty(vals []any, size int) []string {
	filled := make([]string, size)

	for i := 0; i < len(filled); i++ {
		if i >= len(vals) {
			filled[i] = "-"
			continue
		}
		v := vals[i]
		if v == "" {
			filled[i] = "-"
		} else {
			filled[i] = toString(v)
		}
	}
	return filled
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
func toString(val any) string {
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

// タイトルシートを読み込む
func readTitle(srv *sheets.Service, spreadsheetID string) (*Title, error) {
	readRange := "title!A2:B2" // ヘッダー行を除く、1行のみ
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("タイトルシートの読み込みエラー: %v", err)
	}

	if len(resp.Values) == 0 || len(resp.Values[0]) < 2 {
		return nil, fmt.Errorf("タイトルシートにデータがありません")
	}

	row := resp.Values[0]
	title := &Title{
		Title:      toString(row[0]),
		Background: toString(row[1]),
	}

	return title, nil
}

// タイトルJSONを保存
func saveTitleJSON(title Title) error {
	data, err := json.MarshalIndent(title, "", "  ")
	if err != nil {
		return err
	}

	outputPath := "../data/title.json"
	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return err
	}

	fmt.Printf("✓ %s を保存しました\n", outputPath)
	return nil
}
