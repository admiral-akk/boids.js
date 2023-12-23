import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import GUI from 'lil-gui'
import overlayVertexShader from './shaders/overlay/vertex.glsl'
import overlayFragmentShader from './shaders/overlay/fragment.glsl'
import { gsap } from 'gsap'
import Stats from 'stats-js'

/**
 * Core objects
 */
const canvas = document.querySelector('canvas.webgl');
const renderer = new THREE.WebGLRenderer( { canvas });
renderer.setClearColor('#201919')
const scene = new THREE.Scene()
var stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

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
  * Boids
  */

 const boids = []
 const onUpdateBoidCount = (boidCount) => {
     // add boids
     while (boids.length < boidCount) {
         const boidG = new THREE.ConeGeometry(0.04,0.1,8,1);
         boidG.rotateX(Math.PI / 2.);
         const boidM = new THREE.ShaderMaterial({wireframe:true});
         const mesh = new THREE.Mesh(boidG, boidM);
         const boundingBox = configObject.boundingBox;
         mesh.position.multiplyVectors(new THREE.Vector3(
             Math.random() - 0.5,
             Math.random() - 0.5,
             Math.random() - 0.5
         ).multiplyScalar(2.), new THREE.Vector3(
             boundingBox.width,
             boundingBox.height,
             boundingBox.length
         ));
         mesh.velocity = new THREE.Vector3(
             Math.random() - 0.5, Math.random() - 0.5,Math.random() - 0.5
         ).normalize();
         mesh.nextVelocity = new THREE.Vector3()
         scene.add(mesh);
         boids.push(mesh);
     }
     // remove boids
     while (boids.length > boidCount) {
         scene.remove(boids.pop())
     }
 }

/**
 * Setup camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height);
camera.position.x = 4;
camera.position.y = 4;
camera.position.z = 4;
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement)
controls.enabled = true;

/**
 * Debug
 */

const configObject = {
    timeSpeed: 1.0,
    boidCount: 10,
    boundingBox: {
        width: 3,
        length: 3,
        height: 3
    },
    seperation: {
        power: 4.,
        range: 0.1,
    },
    alignment: {
        power: 0.6,
        range: 2.,
    },
    cohesion: {
        power: 1.5,
        range: 3.,
    }
}
const gui = new GUI();
const simulation = gui.addFolder( 'Simulation' );
simulation.add(configObject, 'timeSpeed').min(0).max(3).step(0.1);
simulation.add(configObject, 'boidCount').min(5).max(1000).step(1).onChange(onUpdateBoidCount);
onUpdateBoidCount(configObject.boidCount)
const seperation = gui.addFolder( 'Seperation' );
seperation.add(configObject.seperation, 'power').min(0).max(6).step(0.1);
seperation.add(configObject.seperation, 'range').min(0).max(1).step(0.05);
const alignment = gui.addFolder( 'Alignment' );
alignment.add(configObject.alignment, 'power').min(0).max(3).step(0.1);
alignment.add(configObject.alignment, 'range').min(0).max(3).step(0.1);
const cohesion = gui.addFolder( 'Cohesion' );
cohesion.add(configObject.cohesion, 'power').min(0).max(3).step(0.1);
cohesion.add(configObject.cohesion, 'range').min(0).max(3).step(0.1);

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
  * Bounding Box
  */


 const boxG = new THREE.BoxGeometry(1,1,1);
 const boxM = new THREE.MeshBasicMaterial({wireframe: true, color: 0x0000ff})
 const boxMesh = new THREE.Mesh(boxG, boxM);
 scene.add(boxMesh);
 const updateBoundingBox = () => {
    boxMesh.scale.set(
        2*configObject.boundingBox.width,
        2*configObject.boundingBox.height,
        2*configObject.boundingBox.length)
    boxMesh.matrixWorldNeedsUpdate = true
 }
 updateBoundingBox()
 const box = gui.addFolder( 'Bounding Box' );
 box.add(configObject.boundingBox, 'width').min(1).max(5).step(0.1).onChange(updateBoundingBox);
 box.add(configObject.boundingBox, 'length').min(1).max(5).step(0.1).onChange(updateBoundingBox);
 box.add(configObject.boundingBox, 'height').min(1).max(5).step(0.1).onChange(updateBoundingBox);


/**
 * update boids
 * 
 * rules: https://en.wikipedia.org/wiki/Boids
 */

const moveBoids = (_, deltaTime) => {
    // Update velocities
    const boundingBox = configObject.boundingBox;
    
    console.log(boundingBox.width)
    for (let i = 0; i < boids.length; i++){
        const boid = boids[i];
        // seperation
        const {seperation, alignment, cohesion} = configObject;
        let seperationDelta = new THREE.Vector3();
        let alignmentDelta = new THREE.Vector3();
        let cohesionMeanPosition = new THREE.Vector3();
        let cohesionCount = 0;
        const boidV = boids[i].velocity.clone();
        for (let j = 0; j < boids.length; j++) {
            if (j === i) {
                continue;
            }
            const pos = boids[j].position.clone();
            pos.sub(boid.position);

            const dist = pos.length();
            if (dist <= seperation.range) {
                pos.multiplyScalar((seperation.range - dist)/ seperation.range);
                seperationDelta.add(pos)
            }
            if (dist <= alignment.range) {
                alignmentDelta.add(boids[j].velocity.clone().sub(boidV))
            }
            if (dist <= cohesion.range) {
                cohesionMeanPosition.add(boids[j].position)
                cohesionCount++;
            }
        }
        seperationDelta.normalize().multiplyScalar(- deltaTime * seperation.power);
        alignmentDelta.normalize().multiplyScalar(deltaTime * alignment.power);
        const cohesionDelta = cohesionCount > 0 ? cohesionMeanPosition
            .sub(boid.position)
            .normalize()
            .multiplyScalar(deltaTime * cohesion.power / cohesionCount) : new THREE.Vector3();

        // Apply Boid acceleration changes
        const acceleration = cohesionDelta.add(seperationDelta).add(alignmentDelta);
        boid.nextVelocity.add(acceleration).normalize();

        // bounding box
        if (boid.position.x * Math.sign(boid.velocity.x) > boundingBox.width) {
            boid.nextVelocity.x *= -1;
        }
        if (boid.position.y * Math.sign(boid.velocity.y) > boundingBox.height) {
            boid.nextVelocity.y *= -1;
        }
        if (boid.position.z * Math.sign(boid.velocity.z) > boundingBox.length) {
            boid.nextVelocity.z *= -1;
        }
    }

    // Update position + velocity
    for (const boid of boids) {
        const boidV = boid.velocity.clone().multiplyScalar(deltaTime);
        boid.position.add(boidV);
        boidV.add(boid.position); 
        boid.lookAt(boidV);
        boid.velocity = boid.nextVelocity;
    }
}

/**
 * Animation
 */
const clock = new THREE.Clock()
const tick = () =>
{
    stats.begin()
    const deltaTime = controls.enabled * configObject.timeSpeed * clock.getDelta();
    timeTracker.elapsedTime += deltaTime;

    // update controls
    controls.update()

    // Render scene
    moveBoids(timeTracker.elapsedTime, deltaTime)
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
    stats.end()
}

tick()

