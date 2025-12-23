// ゲームエンジン
class GameEngine {
    constructor() {
        this.characters = {};
        this.scenarios = [];
        this.currentSceneIndex = 0;
        this.currentScene = null;
        this.isWaitingForInput = false;

        // テキスト表示関連
        this.textSpeed = 50; // 1文字あたりの表示速度（ミリ秒）
        this.isTyping = false; // 現在タイピング中かどうか
        this.typewriterTimer = null; // タイマーID
        this.fullText = ''; // 表示予定の全文

        // DOM要素
        this.elements = {
            background: document.getElementById('background'),
            characterLeft: document.getElementById('character-left'),
            characterCenter: document.getElementById('character-center'),
            characterRight: document.getElementById('character-right'),
            textBox: document.getElementById('text-box'),
            namePlate: document.getElementById('name-plate'),
            dialogueText: document.getElementById('dialogue-text'),
            continueIndicator: document.getElementById('continue-indicator'),
            choiceContainer: document.getElementById('choice-container'),
            startScreen: document.getElementById('start-screen'),
            startButton: document.getElementById('start-button'),
            progressIndicator: document.getElementById('progress-indicator')
        };

        this.characterManager = new CharacterManager(this.elements);
        this.effectManager = new EffectManager(this.elements);

        this.init();
    }

    async init() {
        // タイトル設定を読み込み
        await this.loadTitleConfig();

        // スタートボタンのイベント設定
        this.elements.startButton.addEventListener('click', () => this.startGame());

        // クリックで次へ進む / タイピングスキップ
        document.addEventListener('click', (e) => {
            // 選択肢ボタンやスタートボタンのクリックは無視
            if (e.target.classList.contains('choice-button') ||
                e.target.id.includes('start')) {
                return;
            }

            this.handleNext();
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // Rキー: シナリオ再読み込み（デバッグ機能）
            if (e.key === 'r' || e.key === 'R') {
                this.reloadData();
                return;
            }

            // スペースバー: 次へ進む / タイピングスキップ
            if (e.key === ' ' || e.code === 'Space') {
                // ボタンがフォーカスされている場合は無視
                if (e.target.tagName === 'BUTTON') {
                    return;
                }

                // スペースバーのデフォルト動作（ページスクロール）を無効化
                e.preventDefault();

                // キーリピート（長押し）は無視
                if (e.repeat) {
                    return;
                }

                this.handleNext();
            }
        });
    }

    async loadTitleConfig() {
        try {
            const response = await fetch('data/title.json');
            const titleConfig = await response.json();

            // タイトルテキストを設定
            const titleElement = document.querySelector('#start-screen h1');
            if (titleElement && titleConfig.title) {
                titleElement.textContent = titleConfig.title;
            }

            // タイトル背景を設定
            if (titleConfig.background) {
                this.elements.startScreen.style.backgroundImage = `url('${titleConfig.background}')`;
                this.elements.startScreen.style.backgroundSize = 'cover';
                this.elements.startScreen.style.backgroundPosition = 'center';
            }

            console.log('タイトル設定読み込み完了:', titleConfig);
        } catch (error) {
            console.warn('タイトル設定の読み込みに失敗しました（デフォルト設定を使用）:', error);
        }
    }

    async loadData() {
        try {
            const [charactersRes, scenariosRes] = await Promise.all([
                fetch('data/characters.json'),
                fetch('data/scenario.json')
            ]);

            this.characters = await charactersRes.json();
            this.scenarios = await scenariosRes.json();

            console.log('データ読み込み完了:', {
                characters: Object.keys(this.characters).length,
                scenarios: this.scenarios.length
            });
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            alert('ゲームデータの読み込みに失敗しました');
        }
    }

    async startGame() {
        // スタート画面を非表示
        this.elements.startScreen.classList.add('hidden');

        // データ読み込み
        await this.loadData();

        // テキストボックスを表示
        this.elements.textBox.classList.add('visible');

        // 進行度表示を表示
        this.elements.progressIndicator.classList.add('visible');

        // デバッグ機能: クエリパラメータでシーンIDを指定
        const urlParams = new URLSearchParams(window.location.search);
        const sceneId = urlParams.get('id');

        if (sceneId !== null) {
            const sceneIndex = parseInt(sceneId, 10);
            if (!isNaN(sceneIndex) && sceneIndex >= 0 && sceneIndex < this.scenarios.length) {
                this.currentSceneIndex = sceneIndex;
                console.log(`デバッグモード: シーン${sceneIndex}から開始`);
            } else {
                console.warn(`無効なシーンID: ${sceneId}`);
                this.currentSceneIndex = 0;
            }
        } else {
            // 最初のシーンから開始
            this.currentSceneIndex = 0;
        }

        this.playScene();
    }

    playScene() {
        if (this.currentSceneIndex >= this.scenarios.length) {
            this.endGame();
            return;
        }

        const scene = this.scenarios[this.currentSceneIndex];
        this.currentScene = scene;

        console.log('シーン再生:', scene);

        // 進行度更新
        this.updateProgress();

        // 背景変更
        if (scene.background) {
            this.effectManager.changeBackground(scene.background);
        }

        // キャラクター表示
        if (scene.character_id && scene.character_id !== '-') {
            const character = this.characters[scene.character_id];
            if (character) {
                this.characterManager.showCharacter(
                    character,
                    scene.position || 'center',
                    scene.effect
                );
                this.elements.namePlate.textContent = character.name;
                this.elements.namePlate.style.display = 'block';
            }
        } else {
            this.elements.namePlate.textContent = '';
            this.elements.namePlate.style.display = 'none';
        }

        // 台詞表示
        if (scene.type === 'dialogue') {
            this.displayDialogue(scene.text);
            this.isWaitingForInput = true;
        } else if (scene.type === 'choice') {
            this.showChoices(scene);
        } else if (scene.type === 'hide_character') {
            // キャラクター非表示
            this.characterManager.hideCharacter(scene.position, scene.effect);
            // 自動的に次のシーンへ進む
            setTimeout(() => {
                this.currentSceneIndex++;
                this.playScene();
            }, 300); // アニメーション時間を考慮
        }
    }

    updateProgress() {
        const progress = Math.floor((this.currentSceneIndex / this.scenarios.length) * 100);
        this.elements.progressIndicator.textContent = `シナリオ進行度: ${progress}%`;
    }

    displayDialogue(text) {
        this.fullText = text;
        this.elements.dialogueText.textContent = '';
        this.elements.continueIndicator.style.display = 'none';
        this.isTyping = true;

        let currentIndex = 0;

        const typeNextChar = () => {
            if (currentIndex < this.fullText.length) {
                this.elements.dialogueText.textContent += this.fullText[currentIndex];
                currentIndex++;
                this.typewriterTimer = setTimeout(typeNextChar, this.textSpeed);
            } else {
                // タイピング完了
                this.isTyping = false;
                this.elements.continueIndicator.style.display = 'block';
            }
        };

        typeNextChar();
    }

    skipTypewriter() {
        // タイマーをクリア
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }

        // 全文を即座に表示
        this.elements.dialogueText.textContent = this.fullText;
        this.isTyping = false;
        this.elements.continueIndicator.style.display = 'block';
    }

    showChoices(scene) {
        this.isWaitingForInput = false;
        this.elements.continueIndicator.style.display = 'none';
        this.elements.textBox.classList.remove('visible');

        // 選択肢を表示
        this.elements.choiceContainer.innerHTML = '';
        this.elements.choiceContainer.classList.remove('hidden');

        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-button';
                button.textContent = choice.text;
                button.addEventListener('click', () => {
                    this.selectChoice(choice.next_scene);
                });
                this.elements.choiceContainer.appendChild(button);
            });
        }
    }

    selectChoice(nextSceneId) {
        // 選択肢を非表示
        this.elements.choiceContainer.classList.add('hidden');
        this.elements.textBox.classList.add('visible');

        // 次のシーンのインデックスを見つける
        const nextIndex = this.scenarios.findIndex(s => s.scene_id === nextSceneId);
        if (nextIndex !== -1) {
            this.currentSceneIndex = nextIndex;
        } else {
            this.currentSceneIndex++;
        }

        this.playScene();
    }

    next() {
        if (!this.isWaitingForInput) return;

        this.isWaitingForInput = false;

        // タイマーをクリア（念のため）
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }

        // 次のシーンへ
        this.currentSceneIndex++;
        this.playScene();
    }

    handleNext() {
        // タイピング中の場合はスキップ
        if (this.isTyping) {
            this.skipTypewriter();
        }
        // タイピング完了後は次のシーンへ
        else if (this.isWaitingForInput) {
            this.next();
        }
    }

    endGame() {
        this.elements.namePlate.textContent = '';
        this.elements.namePlate.style.display = 'none';
        this.displayDialogue('おわり');
        this.isWaitingForInput = false;

        // 進行度を100%に設定
        this.elements.progressIndicator.textContent = 'シナリオ進行度: 100%';
    }

    async reloadData() {
        console.log('シナリオデータを再読み込み中...');

        // 現在のシーンインデックスを保存
        const savedSceneIndex = this.currentSceneIndex;

        // データを再読み込み
        await this.loadData();

        // 保存したシーンインデックスを復元
        this.currentSceneIndex = savedSceneIndex;

        // シーンを再開
        this.playScene();

        console.log(`シーン${savedSceneIndex}から再開しました`);
    }
}

// キャラクター管理クラス
class CharacterManager {
    constructor(elements) {
        this.elements = elements;
        this.currentCharacters = {
            left: null,
            center: null,
            right: null
        };
    }

    showCharacter(character, position, effect) {
        const positionKey = position || 'center';
        const element = this.elements[`character${this.capitalizeFirst(positionKey)}`];

        if (!element) return;

        // 画像を設定
        element.style.backgroundImage = `url('${character.image_path}')`;

        // エフェクトを適用
        if (effect === 'slide') {
            element.classList.add('slide');
            element.classList.remove('visible');
            setTimeout(() => {
                element.classList.remove('slide');
                element.classList.add('visible');
            }, 50);
        } else if (effect === 'fade') {
            element.classList.remove('slide', 'visible');
            setTimeout(() => {
                element.classList.add('visible');
            }, 50);
        } else if (effect === 'shake') {
            element.classList.remove('slide');
            element.classList.add('visible');
            // 既にshakeクラスがある場合は一旦削除（連続shake対応）
            element.classList.remove('shake');
            // 次のフレームでshakeを追加（アニメーション再生のため）
            setTimeout(() => {
                element.classList.add('shake');
                setTimeout(() => {
                    element.classList.remove('shake');
                }, 500);
            }, 50);
        } else {
            // エフェクトなし: transitionを無効化して即座に表示
            element.classList.remove('slide');
            element.style.transition = 'none';
            element.classList.add('visible');
            setTimeout(() => {
                element.style.transition = '';
            }, 50);
        }

        this.currentCharacters[positionKey] = character;
    }

    hideCharacter(position, effect) {
        const positionKey = position || 'center';
        const element = this.elements[`character${this.capitalizeFirst(positionKey)}`];

        if (!element) return;

        if (effect === 'fade') {
            // フェード: その場で透明に（位置は変わらない）
            element.classList.remove('visible');
        } else if (effect === 'slide') {
            // スライドアウト: 横にスライドしながら消える
            element.classList.add('slide');
            element.classList.remove('visible');
        } else {
            // デフォルト: transitionを無効化して即座に非表示
            element.style.transition = 'none';
            element.classList.remove('visible');
            setTimeout(() => {
                element.style.transition = '';
            }, 50);
        }

        this.currentCharacters[positionKey] = null;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// エフェクト管理クラス
class EffectManager {
    constructor(elements) {
        this.elements = elements;
        this.currentBackground = null;
    }

    changeBackground(backgroundPath) {
        if (backgroundPath === '-' || !backgroundPath) return;

        const bg = this.elements.background;

        bg.style.opacity = '0';
        setTimeout(() => {
            bg.style.backgroundImage = `url('${backgroundPath}')`;
            bg.style.opacity = '1';
        }, 100);

        this.currentBackground = backgroundPath;
    }

    shake(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }
}

// ゲーム開始
const game = new GameEngine();
