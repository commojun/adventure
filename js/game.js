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
            startButton: document.getElementById('start-button')
        };

        this.characterManager = new CharacterManager(this.elements);
        this.effectManager = new EffectManager(this.elements);

        this.init();
    }

    init() {
        // スタートボタンのイベント設定
        this.elements.startButton.addEventListener('click', () => this.startGame());

        // クリックで次へ進む / タイピングスキップ
        document.addEventListener('click', (e) => {
            // 選択肢ボタンやスタートボタンのクリックは無視
            if (e.target.classList.contains('choice-button') ||
                e.target.id.includes('start')) {
                return;
            }

            // タイピング中の場合はスキップ
            if (this.isTyping) {
                this.skipTypewriter();
            }
            // タイピング完了後は次のシーンへ
            else if (this.isWaitingForInput) {
                this.next();
            }
        });
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

        // 最初のシーンから開始
        this.currentSceneIndex = 0;
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
        }
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

    endGame() {
        this.elements.namePlate.textContent = '';
        this.elements.namePlate.style.display = 'none';
        this.displayDialogue('おわり');
        this.isWaitingForInput = false;
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
        if (effect === 'slide_in') {
            element.classList.remove('visible');
            setTimeout(() => {
                element.classList.add('visible');
            }, 50);
        } else if (effect === 'fade') {
            element.style.opacity = '0';
            element.classList.add('visible');
            setTimeout(() => {
                element.style.opacity = '1';
            }, 50);
        } else {
            element.classList.add('visible');
        }

        // 振動エフェクト
        if (effect === 'shake') {
            element.classList.add('shake');
            setTimeout(() => {
                element.classList.remove('shake');
            }, 500);
        }

        this.currentCharacters[positionKey] = character;
    }

    hideCharacter(position, effect) {
        const positionKey = position || 'center';
        const element = this.elements[`character${this.capitalizeFirst(positionKey)}`];

        if (!element) return;

        if (effect === 'slide_out' || effect === 'fade') {
            element.classList.remove('visible');
        } else {
            element.style.opacity = '0';
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

    changeBackground(backgroundPath, effect = 'fade') {
        if (backgroundPath === '-' || !backgroundPath) return;

        const bg = this.elements.background;

        if (effect === 'fade') {
            bg.style.opacity = '0';
            setTimeout(() => {
                bg.style.backgroundImage = `url('${backgroundPath}')`;
                bg.style.opacity = '1';
            }, 500);
        } else {
            bg.style.backgroundImage = `url('${backgroundPath}')`;
        }

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
