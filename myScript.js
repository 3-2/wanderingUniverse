import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

const clock = new THREE.Clock();

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

scene.add(new THREE.AmbientLight(0xdbdbdb));

const container = document.getElementById('container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const STEPS_PER_FRAME = 5;

const worldOctree = new Octree();

const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let mouseTime = 0;

const keyStates = {};

document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

container.addEventListener('mousedown', () => {
    document.body.requestPointerLock();
    mouseTime = performance.now();
});

document.body.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
    }
});

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider);
    if (result) {
        playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
}

function updatePlayer(deltaTime) {

    let damping = Math.exp(- 4 * deltaTime) - 1;

    if (keyStates['ShiftLeft']) {
        playerVelocity.addScaledVector(playerVelocity, damping);
    }

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();

    camera.position.copy(playerCollider.end);
}

function getForwardVector() {

    camera.getWorldDirection(playerDirection);
    // playerDirection.y = 0;
    playerDirection.normalize();

    return playerDirection;
}

function getSideVector() {

    camera.getWorldDirection(playerDirection);
    // playerDirection.y = 0;
    if (playerDirection.x > 0) playerDirection.x = - playerDirection.x;
    if (playerDirection.z > 0) playerDirection.z = - playerDirection.z;
    playerDirection.normalize();
    playerDirection.cross(camera.up);

    return playerDirection;
}

function controls(deltaTime) {
    const speedDelta = deltaTime * 25;
    if (keyStates['KeyW']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }

    if (keyStates['KeyS']) {
        playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));
    }

    if (keyStates['KeyA']) {
        playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));
    }

    if (keyStates['KeyD']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }
}
const loader = new GLTFLoader().setPath('./models/gltf/');

// 装载 GLB
loader.load('universeBackground.glb', (gltf) => {
    // 将 GLB 装载到场景中，用的是Group，不是 Object 3D
    scene.add(gltf.scene);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('./assets/backgrounds/universe.jpg', function (texture) {

        texture.encoding = THREE.sRGBEncoding;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
    });

    // 构建场景的八叉树
    worldOctree.fromGraphNode(gltf.scene);

    gltf.scene.traverse(child => {
        if (child.isMesh) {

            // 让场景中的每个mesh节点都能投射并接受阴影
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material.map) {
                // 设定各向异性，参见：https://threejs.org/docs/#api/en/textures/Texture.anisotropy
                child.material.map.anisotropy = 4;
            }
        }
    });
    animate();
});

function animate() {
    const deltaTime = clock.getDelta() / STEPS_PER_FRAME
    for (let i = 0; i < STEPS_PER_FRAME; i++) {

        controls(deltaTime);
        updatePlayer(deltaTime);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
