import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ========== SETUP ==========
let scene, camera, renderer;
let assetManager;
let gameRunning = false;
let gamePaused = false;

// Game objects
let player = null;
let npcs = [];
let police = null;
let bullets = [];
let moneyPickups = [];

// Player stats
let money = 1000;
let health = 100;
let maxHealth = 100;
let wantedLevel = 0;
let ammo = 30;
let playerColor = 0x3498db;

// Footstep
let lastFootstep = 0;

// Joystick
let moveJoystick = { active: false, x: 0, y: 0 };
let cameraJoystick = { active: false, x: 0, y: 0 };

// Settings
let settings = {
    masterVolume: 80,
    sfxVolume: 80,
    musicVolume: 60
};

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingPercent = document.getElementById('loading-percent');
const mainMenu = document.getElementById('main-menu');
const gameUI = document.getElementById('game-ui');
const settingsMenu = document.getElementById('settings-menu');
const characterSelect = document.getElementById('character-select');
const pauseMenu = document.getElementById('pause-menu');
const gameOver = document.getElementById('game-over');

const moneyEl = document.getElementById('money');
const healthEl = document.getElementById('health');
const wantedEl = document.getElementById('wanted');
const wantedStars = document.getElementById('wanted-stars');
const npcCountEl = document.getElementById('npc-count');
const notification = document.getElementById('notification');

// Minimap
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// ========== ASSET MANAGER ==========
class AssetManager {
    constructor() {
        this.models = {};
        this.sounds = {};
        this.textures = {};
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        this.totalAssets = 0;
        this.loadedAssets = 0;
    }
    
    async loadAll() {
        const assets = [
            // Models (7 file)
            { type: 'model', name: 'player', path: 'assets/models/player.glb' },
            { type: 'model', name: 'npc', path: 'assets/models/npc.glb' },
            { type: 'model', name: 'sedan', path: 'assets/models/sedan.glb' },
            { type: 'model', name: 'sport', path: 'assets/models/sport.glb' },
            { type: 'model', name: 'truck', path: 'assets/models/truck.glb' },
            { type: 'model', name: 'police', path: 'assets/models/police.glb' },
            { type: 'model', name: 'map', path: 'assets/models/city_map.glb' },
            
            // Sounds (8 file)
            { type: 'sound', name: 'footstep_concrete', path: 'assets/sounds/effects/footstep_concrete.mp3' },
            { type: 'sound', name: 'footstep_grass', path: 'assets/sounds/effects/footstep_grass.mp3' },
            { type: 'sound', name: 'shoot', path: 'assets/sounds/effects/shoot.mp3' },
            { type: 'sound', name: 'siren', path: 'assets/sounds/effects/police_siren.mp3' },
            { type: 'sound', name: 'cash', path: 'assets/sounds/effects/cash.mp3' },
            { type: 'sound', name: 'npc_die', path: 'assets/sounds/effects/npc_die.mp3' },
            { type: 'sound', name: 'bgm', path: 'assets/sounds/bgm/gameplay.mp3' },
            { type: 'sound', name: 'wasted', path: 'assets/sounds/voices/wasted.mp3' },
            
            // Textures (optional)
            { type: 'texture', name: 'road', path: 'assets/textures/road.jpg' },
            { type: 'texture', name: 'building', path: 'assets/textures/building.jpg' }
        ];
        
        this.totalAssets = assets.length;
        
        const promises = assets.map(asset => this.loadAsset(asset));
        return Promise.all(promises);
    }
    
    loadAsset(asset) {
        return new Promise((resolve, reject) => {
            switch(asset.type) {
                case 'model':
                    this.gltfLoader.load(
                        asset.path,
                        (gltf) => {
                            this.models[asset.name] = gltf.scene;
                            this.assetLoaded(asset.name);
                            resolve(gltf.scene);
                        },
                        undefined,
                        (error) => reject(error)
                    );
                    break;
                    
                case 'texture':
                    this.textureLoader.load(
                        asset.path,
                        (texture) => {
                            this.textures[asset.name] = texture;
                            this.assetLoaded(asset.name);
                            resolve(texture);
                        },
                        undefined,
                        (error) => reject(error)
                    );
                    break;
                    
                case 'sound':
                    const audio = new Audio();
                    audio.src = asset.path;
                    audio.addEventListener('canplaythrough', () => {
                        this.sounds[asset.name] = audio;
                        this.assetLoaded(asset.name);
                        resolve(audio);
                    });
                    audio.addEventListener('error', reject);
                    audio.load();
                    break;
            }
        });
    }
    
    assetLoaded(name) {
        this.loadedAssets++;
        const percent = Math.floor((this.loadedAssets / this.totalAssets) * 100);
        
        if (loadingBar) loadingBar.style.width = percent + '%';
        if (loadingPercent) loadingPercent.textContent = percent + '%';
        if (loadingText) loadingText.textContent = `Loading: ${name}`;
        
        if (this.loadedAssets === this.totalAssets) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                mainMenu.classList.remove('hidden');
            }, 500);
        }
    }
    
    getModel(name) { return this.models[name]; }
    getSound(name) { return this.sounds[name]; }
    
    playSound(name, volume = 1.0, loop = false) {
        const sound = this.sounds[name];
        if (sound) {
            const soundClone = sound.cloneNode();
            soundClone.volume = volume * (settings.masterVolume / 100) * (settings.sfxVolume / 100);
            soundClone.loop = loop;
            soundClone.play().catch(() => {});
            
            if (!loop) {
                setTimeout(() => soundClone.remove(), 2000);
            }
            return soundClone;
        }
    }
    
    playMusic(name, volume = 1.0) {
        const music = this.sounds[name];
        if (music) {
            music.volume = volume * (settings.masterVolume / 100) * (settings.musicVolume / 100);
            music.loop = true;
            music.play().catch(() => {});
        }
    }
    
    stopMusic(name) {
        const music = this.sounds[name];
        if (music) {
            music.pause();
            music.currentTime = 0;
        }
    }
}

// ========== GAME CLASS ==========
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.npcCount = 15;
        this.policeActive = false;
    }
    
    async init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(15, 10, 20);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0x404060);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xfff5d1, 1);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        this.scene.add(sunLight);
        
        // Load assets
        assetManager = new AssetManager();
        await assetManager.loadAll();
        
        // Build world
        this.buildWorld();
        
        // Setup controls
        this.setupControls();
        
        // Start animation
        this.animate();
    }
    
    buildWorld() {
        // Load map
        const mapModel = assetManager.getModel('map');
        if (mapModel) {
            const map = mapModel.clone();
            map.scale.set(0.1, 0.1, 0.1);
            map.position.y = 0;
            map.castShadow = true;
            map.receiveShadow = true;
            this.scene.add(map);
        } else {
            this.createBasicMap();
        }
        
        // Spawn NPCs
        this.spawnNPCs(15);
    }
    
    createBasicMap() {
        // Ground
        const groundGeo = new THREE.CircleGeometry(200, 32);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid
        const gridHelper = new THREE.GridHelper(200, 40, 0xffd700, 0xffffff);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        
        // Roads
        this.createRoad(0, 0, 20, 200, 0);
        this.createRoad(0, 0, 20, 200, Math.PI/2);
        
        // Buildings
        for (let i = 0; i < 20; i++) {
            const height = 5 + Math.random() * 15;
            const buildingGeo = new THREE.BoxGeometry(8, height, 8);
            const buildingMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.position.set(
                (Math.random() - 0.5) * 150,
                height/2,
                (Math.random() - 0.5) * 150
            );
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
        }
    }
    
    createRoad(x, z, width, length, rotationY) {
        const roadGeo = new THREE.BoxGeometry(width, 0.2, length);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x34495e });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set(x, 0.1, z);
        road.rotation.y = rotationY;
        road.receiveShadow = true;
        this.scene.add(road);
        
        // Road lines
        const lineGeo = new THREE.BoxGeometry(1, 0.3, length - 4);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(x, 0.3, z);
        line.rotation.y = rotationY;
        this.scene.add(line);
    }
    
    spawnNPCs(count) {
        const npcModel = assetManager.getModel('npc');
        if (!npcModel) return;
        
        for (let i = 0; i < count; i++) {
            const npc = npcModel.clone();
            npc.scale.set(0.5, 0.5, 0.5);
            
            // Random position
            npc.position.set(
                (Math.random() - 0.5) * 100,
                0,
                (Math.random() - 0.5) * 100
            );
            
            // Random color
            const colors = [0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0x3498db];
            npc.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
                }
            });
            
            npc.castShadow = true;
            npc.receiveShadow = true;
            
            // NPC AI data
            npc.userData = {
                type: 'npc',
                health: 50,
                speed: 0.5 + Math.random() * 0.5,
                direction: new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                ).normalize(),
                changeDirTimer: Math.random() * 100,
                money: 50 + Math.floor(Math.random() * 100)
            };
            
            npcs.push(npc);
            this.scene.add(npc);
        }
        
        if (npcCountEl) npcCountEl.textContent = npcs.length;
    }
    
    spawnPolice() {
        if (police || this.policeActive) return;
        
        const policeModel = assetManager.getModel('police');
        if (!policeModel) return;
        
        police = policeModel.clone();
        police.scale.set(0.5, 0.5, 0.5);
        
        // Spawn far away
        police.position.set(
            player.position.x + (Math.random() - 0.5) * 50,
            0,
            player.position.z + (Math.random() - 0.5) * 50
        );
        
        police.castShadow = true;
        police.receiveShadow = true;
        
        police.userData = {
            type: 'police',
            speed: 2 + wantedLevel * 0.3,
            chasing: true,
            lastSiren: 0
        };
        
        this.scene.add(police);
        this.policeActive = true;
        
        assetManager.playSound('siren', 0.5, true);
        this.showNotification('🚔 POLICE ARRIVED!');
    }
    
    setPlayer(colorHex) {
        if (player) this.scene.remove(player);
        
        const playerModel = assetManager.getModel('player');
        if (playerModel) {
            player = playerModel.clone();
            player.scale.set(0.5, 0.5, 0.5);
            player.position.set(0, 0, 0);
            player.castShadow = true;
            player.receiveShadow = true;
            
            player.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.setHex(colorHex);
                }
            });
            
            player.userData = {
                type: 'player',
                lastShot: 0,
                lastFootstep: 0
            };
            
            this.scene.add(player);
        }
    }
    
    setupControls() {
        // Move joystick
        const moveArea = document.getElementById('move-joystick');
        const moveThumb = document.getElementById('move-thumb');
        
        moveArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            moveJoystick.active = true;
            this.updateJoystick(e, moveArea, moveThumb, moveJoystick);
        });
        
        moveArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (moveJoystick.active) {
                this.updateJoystick(e, moveArea, moveThumb, moveJoystick);
            }
        });
        
        moveArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            moveJoystick.active = false;
            moveJoystick.x = 0;
            moveJoystick.y = 0;
            moveThumb.style.transform = 'translate(-50%, -50%)';
        });
        
        // Camera joystick
        const cameraArea = document.getElementById('camera-joystick');
        const cameraThumb = document.getElementById('camera-thumb');
        
        cameraArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            cameraJoystick.active = true;
            this.updateJoystick(e, cameraArea, cameraThumb, cameraJoystick);
        });
        
        cameraArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (cameraJoystick.active) {
                this.updateJoystick(e, cameraArea, cameraThumb, cameraJoystick);
            }
        });
        
        cameraArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            cameraJoystick.active = false;
            cameraJoystick.x = 0;
            cameraJoystick.y = 0;
            cameraThumb.style.transform = 'translate(-50%, -50%)';
        });
        
        // Shoot button
        const shootBtn = document.getElementById('shoot-btn');
        if (shootBtn) {
            shootBtn.addEventListener('click', () => this.shoot());
        }
        
        // Pause button
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
    }
    
    updateJoystick(e, area, thumb, joystick) {
        const touch = e.touches[0];
        const rect = area.getBoundingClientRect();
        
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;
        
        const maxDist = 30;
        const dist = Math.min(Math.hypot(deltaX, deltaY), maxDist);
        const angle = Math.atan2(deltaY, deltaX);
        
        joystick.x = Math.cos(angle) * dist / maxDist;
        joystick.y = Math.sin(angle) * dist / maxDist;
        
        thumb.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px))`;
    }
    
    // ========== FOOTSTEP FUNCTION ==========
    getSurfaceType(position) {
        // Deteksi permukaan berdasarkan posisi
        // Area tengah kota (concrete) vs pinggiran (grass)
        if (Math.abs(position.x) < 40 && Math.abs(position.z) < 40) {
            return 'concrete';
        } else {
            return 'grass';
        }
    }
    
    shoot() {
        if (!player || ammo <= 0) return;
        
        const now = Date.now();
        if (now - player.userData.lastShot < 300) return;
        
        ammo--;
        player.userData.lastShot = now;
        assetManager.playSound('shoot', 0.5);
        
        // Create bullet
        const bulletGeo = new THREE.SphereGeometry(0.2);
        const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x442200 });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        
        bullet.position.copy(player.position);
        bullet.position.y += 1.5;
        
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
        bullet.userData = { velocity: direction.multiplyScalar(0.8), life: 50 };
        
        bullets.push(bullet);
        this.scene.add(bullet);
        
        // Check hit NPC
        this.checkBulletHit(bullet);
    }
    
    checkBulletHit(bullet) {
        const bulletPos = bullet.position.clone();
        
        for (let i = npcs.length - 1; i >= 0; i--) {
            const npc = npcs[i];
            const dist = bulletPos.distanceTo(npc.position);
            
            if (dist < 2) {
                // Hit NPC
                npc.userData.health -= 50; // Kill instantly
                
                if (npc.userData.health <= 0) {
                    // Remove NPC
                    this.scene.remove(npc);
                    npcs.splice(i, 1);
                    if (npcCountEl) npcCountEl.textContent = npcs.length;
                    
                    // Drop money
                    money += npc.userData.money;
                    this.showNotification(`+$${npc.userData.money}`);
                    
                    // Play sound
                    assetManager.playSound('cash', 0.5);
                    assetManager.playSound('npc_die', 0.5);
                    
                    // Increase wanted level
                    wantedLevel = Math.min(5, wantedLevel + 1);
                    this.updateWanted();
                    
                    // Spawn police if wanted level >= 3
                    if (wantedLevel >= 3 && !police) {
                        this.spawnPolice();
                    }
                }
                
                // Remove bullet
                const index = bullets.indexOf(bullet);
                if (index !== -1) {
                    this.scene.remove(bullet);
                    bullets.splice(index, 1);
                }
                break;
            }
        }
    }
    
    updateWanted() {
        if (wantedEl) wantedEl.textContent = wantedLevel;
        
        let stars = '';
        for (let i = 0; i < wantedLevel; i++) {
            stars += '⭐';
        }
        if (wantedStars) wantedStars.textContent = stars;
    }
    
    togglePause() {
        gamePaused = !gamePaused;
        if (pauseMenu) {
            if (gamePaused) {
                pauseMenu.classList.remove('hidden');
            } else {
                pauseMenu.classList.add('hidden');
            }
        }
    }
    
    showNotification(msg) {
        if (!notification) return;
        notification.textContent = msg;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 2000);
    }
    
    update(delta) {
        if (!gameRunning || gamePaused || !player) return;
        
        // Player movement with footstep
        if (moveJoystick.active && (Math.abs(moveJoystick.x) > 0.1 || Math.abs(moveJoystick.y) > 0.1)) {
            const speed = 3 * delta;
            player.position.x += moveJoystick.x * speed;
            player.position.z += moveJoystick.y * speed;
            
            // Rotate player
            const angle = Math.atan2(moveJoystick.x, moveJoystick.y);
            player.rotation.y = angle;
            
            // ========== FOOTSTEP SOUND ==========
            const now = Date.now();
            if (now - lastFootstep > 300) { // Cooldown 300ms
                lastFootstep = now;
                
                // Deteksi permukaan
                const surface = this.getSurfaceType(player.position);
                
                // Mainkan suara sesuai permukaan
                if (surface === 'concrete') {
                    assetManager.playSound('footstep_concrete', 0.3);
                } else {
                    assetManager.playSound('footstep_grass', 0.3);
                }
            }
            // ========== END FOOTSTEP ==========
        }
        
        // NPC random movement
        npcs.forEach(npc => {
            // Random direction change
            npc.userData.changeDirTimer -= delta;
            if (npc.userData.changeDirTimer <= 0) {
                npc.userData.direction.set(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                ).normalize();
                npc.userData.changeDirTimer = 2 + Math.random() * 3;
            }
            
            // Move NPC
            npc.position.x += npc.userData.direction.x * npc.userData.speed * delta;
            npc.position.z += npc.userData.direction.z * npc.userData.speed * delta;
            
            // Rotate NPC towards movement
            if (npc.userData.direction.length() > 0.1) {
                const angle = Math.atan2(npc.userData.direction.x, npc.userData.direction.z);
                npc.rotation.y = angle;
            }
            
            // Boundary check
            if (Math.abs(npc.position.x) > 90) npc.userData.direction.x *= -1;
            if (Math.abs(npc.position.z) > 90) npc.userData.direction.z *= -1;
        });
        
        // Police chase
        if (police && wantedLevel > 0) {
            const dx = player.position.x - police.position.x;
            const dz = player.position.z - police.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist > 2) {
                police.position.x += (dx / dist) * (2 + wantedLevel * 0.5) * delta;
                police.position.z += (dz / dist) * (2 + wantedLevel * 0.5) * delta;
                
                // Rotate police
                const angle = Math.atan2(dx, dz);
                police.rotation.y = angle;
            }
            
            // Check collision with player
            if (dist < 3) {
                health -= 10 * delta;
                if (healthEl) healthEl.textContent = Math.floor(health);
                
                if (health <= 0) {
                    this.gameOver('CAUGHT BY POLICE!');
                }
            }
        }
        
        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.x += b.userData.velocity.x;
            b.position.z += b.userData.velocity.z;
            b.userData.life--;
            
            if (b.userData.life <= 0 || Math.abs(b.position.x) > 100 || Math.abs(b.position.z) > 100) {
                this.scene.remove(b);
                bullets.splice(i, 1);
            } else {
                this.checkBulletHit(b);
            }
        }
        
        // Camera follow
        const target = player.position;
        
        if (cameraJoystick.active && (Math.abs(cameraJoystick.x) > 0.1 || Math.abs(cameraJoystick.y) > 0.1)) {
            // Camera orbit
            const angle = Date.now() * 0.001;
            this.camera.position.x = target.x + Math.sin(angle) * 15;
            this.camera.position.z = target.z + Math.cos(angle) * 15;
            this.camera.position.y = 10;
        } else {
            // Default camera
            this.camera.position.x = target.x + 10;
            this.camera.position.z = target.z + 10;
            this.camera.position.y = 8;
        }
        this.camera.lookAt(target);
        
        // Update UI
        if (moneyEl) moneyEl.textContent = money;
        if (healthEl) healthEl.textContent = Math.floor(health);
        
        // Update minimap
        this.updateMinimap();
    }
    
    updateMinimap() {
        if (!minimapCtx) return;
        
        minimapCtx.clearRect(0, 0, 150, 150);
        minimapCtx.fillStyle = '#1a2a3a';
        minimapCtx.fillRect(0, 0, 150, 150);
        
        const scale = 1.5;
        const centerX = 75;
        const centerY = 75;
        
        // Player (center)
        minimapCtx.fillStyle = '#FFD700';
        minimapCtx.beginPath();
        minimapCtx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        minimapCtx.fill();
        
        // NPCs
        npcs.forEach(npc => {
            const dx = (npc.position.x - player.position.x) * scale;
            const dz = (npc.position.z - player.position.z) * scale;
            const x = centerX + dx;
            const y = centerY + dz;
            
            if (x > 0 && x < 150 && y > 0 && y < 150) {
                minimapCtx.fillStyle = '#2ecc71';
                minimapCtx.beginPath();
                minimapCtx.arc(x, y, 3, 0, 2 * Math.PI);
                minimapCtx.fill();
            }
        });
        
        // Police
        if (police) {
            const dx = (police.position.x - player.position.x) * scale;
            const dz = (police.position.z - player.position.z) * scale;
            const x = centerX + dx;
            const y = centerY + dz;
            
            if (x > 0 && x < 150 && y > 0 && y < 150) {
                minimapCtx.fillStyle = '#e74c3c';
                minimapCtx.beginPath();
                minimapCtx.arc(x, y, 4, 0, 2 * Math.PI);
                minimapCtx.fill();
            }
        }
    }
    
    gameOver(message) {
        gameRunning = false;
        const msgEl = document.getElementById('gameover-message');
        if (msgEl) msgEl.textContent = message;
        if (gameOver) gameOver.classList.remove('hidden');
        assetManager.playSound('wasted', 1.0);
        assetManager.stopMusic('bgm');
    }
    
    reset() {
        // Remove all NPCs
        npcs.forEach(npc => this.scene.remove(npc));
        npcs = [];
        
        // Remove police
        if (police) {
            this.scene.remove(police);
            police = null;
            this.policeActive = false;
        }
        
        // Remove bullets
        bullets.forEach(b => this.scene.remove(b));
        bullets = [];
        
        // Reset stats
        money = 1000;
        health = 100;
        wantedLevel = 0;
        ammo = 30;
        
        // Respawn NPCs
        this.spawnNPCs(15);
        
        // Reset player position
        if (player) {
            player.position.set(0, 0, 0);
        }
        
        this.updateWanted();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        this.update(delta);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// ========== INITIALIZATION ==========
const game = new Game();

document.addEventListener('DOMContentLoaded', () => {
    game.init();
});

// Menu navigation
const playBtn = document.getElementById('play-btn');
if (playBtn) {
    playBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        characterSelect.classList.remove('hidden');
    });
}

const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        settingsMenu.classList.remove('hidden');
    });
}

const settingsBack = document.getElementById('settings-back');
if (settingsBack) {
    settingsBack.addEventListener('click', () => {
        settingsMenu.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        
        // Save settings
        const masterVol = document.getElementById('master-volume');
        const sfxVol = document.getElementById('sfx-volume');
        const musicVol = document.getElementById('music-volume');
        
        if (masterVol) settings.masterVolume = masterVol.value;
        if (sfxVol) settings.sfxVolume = sfxVol.value;
        if (musicVol) settings.musicVolume = musicVol.value;
    });
}

const characterBack = document.getElementById('character-back');
if (characterBack) {
    characterBack.addEventListener('click', () => {
        characterSelect.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });
}

// Color selection
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        playerColor = option.dataset.color;
    });
});

const confirmCharacter = document.getElementById('confirm-character');
if (confirmCharacter) {
    confirmCharacter.addEventListener('click', () => {
        characterSelect.classList.add('hidden');
        gameUI.classList.remove('hidden');
        
        game.setPlayer(parseInt(playerColor.replace('#', '0x')));
        gameRunning = true;
        
        assetManager.playMusic('bgm', 0.5);
    });
}

// Pause menu
const resumeBtn = document.getElementById('resume-btn');
if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        gamePaused = false;
        pauseMenu.classList.add('hidden');
    });
}

const quitBtn = document.getElementById('quit-btn');
if (quitBtn) {
    quitBtn.addEventListener('click', () => {
        pauseMenu.classList.add('hidden');
        gameUI.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        gameRunning = false;
        
        assetManager.stopMusic('bgm');
        game.reset();
    });
}

// Game over
const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        gameOver.classList.add('hidden');
        gameUI.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        
        assetManager.stopMusic('bgm');
        game.reset();
    });
}

// Window resize
window.addEventListener('resize', () => {
    if (game.camera && game.renderer) {
        game.camera.aspect = window.innerWidth / window.innerHeight;
        game.camera.updateProjectionMatrix();
        game.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});