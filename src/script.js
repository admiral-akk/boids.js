import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import GUI from 'lil-gui'
import overlayVertexShader from './shaders/overlay/vertex.glsl'
import overlayFragmentShader from './shaders/overlay/fragment.glsl'
import { gsap } from 'gsap'

/**
 * Core objects
 */
const canvas = document.querySelector('canvas.webgl');
const renderer = new THREE.WebGLRenderer( { canvas });
renderer.setClearColor('#201919')
const scene = new THREE.Scene()

/**
 * Loader Setup
 */

const loadingManager = new THREE.LoadingManager()
const textureLoader = new THREE.TextureLoader(loadingManager);
const dracoLoader = new DRACOLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);
dracoLoader.setDecoderPath("./draco/gltf/");

/**
 * Load texture
 */
const texture = textureLoader.load('https://source.unsplash.com/random/100x100?sig=1')

/**
 * Window size
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix() 
    
    // Render
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


if (window.screen && window.screen.orientation) {
    window.screen.orientation.onchange = () => {
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight
    
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix() 
        
        // Render
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
}

window.addEventListener('dblclick', () => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement

    if (fullscreenElement) {
        document.exitFullscreen();
    } else {
        canvas.requestFullscreen()
    }
})

/**
 * Setup camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height);
camera.position.x = 1;
camera.position.y = 1;
camera.position.z = 1;
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement)
controls.enabled = true;

/**
 * Debug
 */

const debugObject = {
    timeSpeed: 1.0,
    seperation: {
        power: 1.,
        range: 1.,
    },
    alignment: {
        power: 1.,
        range: 1.,
    },
    cohesion: {
        power: 1.,
        range: 1.,
    }
    }
const gui = new GUI();
gui.add(debugObject, 'timeSpeed').min(0).max(3).step(0.1);
const seperation = gui.addFolder( 'Seperation' );
seperation.add(debugObject.seperation, 'power').min(0).max(3).step(0.1);
seperation.add(debugObject.seperation, 'range').min(0).max(3).step(0.1);
const alignment = gui.addFolder( 'Alignment' );
alignment.add(debugObject.alignment, 'power').min(0).max(3).step(0.1);
alignment.add(debugObject.alignment, 'range').min(0).max(3).step(0.1);
const cohesion = gui.addFolder( 'Cohesion' );
cohesion.add(debugObject.cohesion, 'power').min(0).max(3).step(0.1);
cohesion.add(debugObject.cohesion, 'range').min(0).max(3).step(0.1);

/**
 * Loading overlay
 */
const overlayGeometry = new THREE.PlaneGeometry(2, 2,1,1);
const overlayMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: overlayVertexShader,
    fragmentShader: overlayFragmentShader,
    uniforms: {
        uMinY: {value: 0.0},
        uWidthY: {value: 0.005},
        uMaxX: {value: 0.0},
    }
})
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
scene.add(overlay)

/**
 * Loading Animation
 */
let progressRatio = 0.0
let timeTracker = {enabled: false, elapsedTime: 0.0}
loadingManager.onProgress = (_, itemsLoaded, itemsTotal) =>
{
    progressRatio = Math.max(itemsLoaded / itemsTotal, progressRatio)
    gsap.to(overlayMaterial.uniforms.uMaxX, {duration: 1., value: progressRatio})
    if (progressRatio == 1.) {
        const timeline = gsap.timeline();
        timeline.to(overlayMaterial.uniforms.uWidthY, {duration: 0.2, delay:1.0, value: 0.01, ease:'power1.inOut'})
        timeline.to(overlayMaterial.uniforms.uWidthY, {duration: 0.2, value: 0.0, ease: 'power1.in'})
        timeline.set(timeTracker, {enabled: true})
        timeline.to(overlayMaterial.uniforms.uMinY, {duration: 0.6, value: 0.5, ease: 'power1.in'})
    }
 };

 /**
  * Boids
  */

 const boids = []
 const boidCount = 10;
 while (boids.length < boidCount) {
    const boidG = new THREE.ConeGeometry(0.4,1.0,8,1);
    boidG.rotateX(Math.PI / 2.);
    const boidM = new THREE.ShaderMaterial({wireframe:true});
    const mesh = new THREE.Mesh(boidG, boidM);
    scene.add(mesh);
    boids.push(mesh);
 }


const velocities = new Float32Array(boids.length * 3);

for (let i = 0; i < boids.length; i++) {
    const initVel = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.5,Math.random() - 0.5
    ).normalize();
    velocities[3*i] = initVel.x
    velocities[3*i+1] = initVel.y
    velocities[3*i+2] = initVel.z
}

/**
 * update boids
 * 
 * rules: https://en.wikipedia.org/wiki/Boids
 */


const moveBoids = (_, deltaTime) => {
    // Update velocities
    for (let i = 0; i < boids.length; i++){

        // bounding box
        if (boids[i].position.x * Math.sign(velocities[3*i]) > 3) {
            velocities[3*i] *= -1;
        }
        if (boids[i].position.y * Math.sign(velocities[3*i+1]) > 3) {
            velocities[3*i+1] *= -1;
        }
        if (boids[i].position.z * Math.sign(velocities[3*i+2]) > 3) {
            velocities[3*i+2] *= -1;
        }
    }
    // Update positions
    for (let i = 0; i < boids.length; i++){
        boids[i].position.x += deltaTime*velocities[3*i];
        if (boids[i].position.x * Math.sign(velocities[3*i]) > 3) {
            velocities[3*i] *= -1;
        }
        boids[i].position.y += deltaTime*velocities[3*i+1];
        if (boids[i].position.y * Math.sign(velocities[3*i+1]) > 3) {
            velocities[3*i+1] *= -1;
        }
        boids[i].position.z += deltaTime*velocities[3*i+2];
        if (boids[i].position.z * Math.sign(velocities[3*i+2]) > 3) {
            velocities[3*i+2] *= -1;
        }
        const dir = new THREE.Vector3(velocities[3*i],velocities[3*i+1],velocities[3*i+2]).add(boids[i].position)
        boids[i].lookAt(dir);
        boids[i].matrixWorldNeedsUpdate = true;
    }

}

/**
 * Animation
 */
const clock = new THREE.Clock()
const tick = () =>
{
    const deltaTime = controls.enabled * debugObject.timeSpeed * clock.getDelta();
    timeTracker.elapsedTime += deltaTime;

    // update controls
    controls.update()

    // Render scene
    moveBoids(timeTracker.elapsedTime, deltaTime)
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()

