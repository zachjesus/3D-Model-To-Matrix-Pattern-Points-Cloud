import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Tween, Group } from '@tweenjs/tween.js';
import {
    computeBoundsTree, disposeBoundsTree, acceleratedRaycast,
} from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const particleRadius = 40;
const group = new Group(); 


let cameraProgress = 0; // Progress along the curve (0 to 1)
const cameraSpeed = 0.0012; // Adjust speed as needed  

let scene, camera, renderer, controls, curve;
let pointsMesh0, pointsMesh1;
let uniforms = {
    particles: {
        action: { value: 0 },
        delayRatio: { value: 0.875 },
    }
};

init();
animate();

function init() {
    initScene();
    initCamera();
    initRenderer();
    initControls();
    defineCameraPath();
    loadModel();
    window.addEventListener('resize', onWindowResize, false);

    const gathering = new Tween(uniforms.particles.action)
        .to({ value: 1 }, 30000)
        .delay(1000)
        .onComplete(() => {
            console.log('Animation Complete');
        })
        .start(); 

    group.add(gathering); 
}

function initScene() {
    scene = new THREE.Scene();
}

function defineCameraPath() {
    curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(40, 0, 40),
        new THREE.Vector3(-40, 0, 40),
        new THREE.Vector3(-40, 0, -40),
        new THREE.Vector3(40, 0, -40),
        new THREE.Vector3(40, 0, 40),
        new THREE.Vector3(0, 0, 20)
    ],
    );

    const tubeGeometry = new THREE.TubeGeometry(curve, 100, 2, 8, true);
    const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    //scene.add(tube);
}

function initCamera() {
    camera = new THREE.PerspectiveCamera(
        80,
        window.innerWidth / window.innerHeight,
        0.01,
        3000
    );
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

function initControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.target.set(0, 0, 0);
    controls.enabled = false;
}

function loadModel() {
    const loader = new GLTFLoader();
    loader.load('./ModelofMyName.glb', function (gltf) {
        const model = gltf.scene.children[0];
        model.material.side = THREE.DoubleSide;
        model.material.normalMapType = THREE.ObjectSpaceNormalMap;

        let geom = model.geometry;

        geom.rotateX(Math.PI / 2);

        geom.computeVertexNormals();
        geom.center();
        geom.computeBoundsTree();

        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 0
        });
        const mesh = new THREE.Mesh(geom, material);
        scene.add(mesh);
        mesh.visible = false;

        createPoints(mesh);
    });
}

function createPoints(mesh) {
    const { positions, positionsStart, positionsDelay } = fillWithPoints(mesh, 5000);

    const points0 = [];
    const points1 = [];
    const startPoints0 = [];
    const startPoints1 = [];
    const delays0 = [];
    const delays1 = [];

    for (let i = 0; i < positions.length; i += 3) {
        if (Math.random() < 0.5) {
            points0.push(positions[i], positions[i + 1], positions[i + 2]);
            startPoints0.push(positionsStart[i], positionsStart[i + 1], positionsStart[i + 2]);
            delays0.push(positionsDelay[i / 3]);
        } else {
            points1.push(positions[i], positions[i + 1], positions[i + 2]);
            startPoints1.push(positionsStart[i], positionsStart[i + 1], positionsStart[i + 2]);
            delays1.push(positionsDelay[i / 3]);
        }
    }

    const pointsGeometry0 = new THREE.BufferGeometry();
    pointsGeometry0.setAttribute('position', new THREE.Float32BufferAttribute(points0, 3));
    pointsGeometry0.setAttribute('positionStart', new THREE.Float32BufferAttribute(startPoints0, 3));
    pointsGeometry0.setAttribute('positionDelay', new THREE.Float32BufferAttribute(delays0, 1));

    const pointsGeometry1 = new THREE.BufferGeometry();
    pointsGeometry1.setAttribute('position', new THREE.Float32BufferAttribute(points1, 3));
    pointsGeometry1.setAttribute('positionStart', new THREE.Float32BufferAttribute(startPoints1, 3));
    pointsGeometry1.setAttribute('positionDelay', new THREE.Float32BufferAttribute(delays1, 1));

    const pointsMaterial0 = createPointsMaterial(.85, '0', 'green');
    const pointsMaterial1 = createPointsMaterial(.85, '1', 'green');

    pointsMesh0 = new THREE.Points(pointsGeometry0, pointsMaterial0);
    pointsMesh1 = new THREE.Points(pointsGeometry1, pointsMaterial1);

    pointsMesh0.frustumCulled = false;
    pointsMesh1.frustumCulled = false;

    scene.add(pointsMesh0);
    scene.add(pointsMesh1);
}

function createPointsMaterial(size, text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = '48px Arial';
    context.fillText(text, 10, 50);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return new THREE.PointsMaterial({
        size: size,
        sizeAttenuation: true,
        map: texture,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
        onBeforeCompile: (shader) => {
            shader.uniforms.action = uniforms.particles.action;
            shader.uniforms.delayRatio = uniforms.particles.delayRatio;
            shader.vertexShader = `
            #define s(a, b, c) smoothstep(a, b, c)

            uniform float action;
            uniform float delayRatio;

            attribute vec3 positionStart;
            attribute float positionDelay;

            varying float vTint;
            varying float vRealAction;
            varying float vAmplitude;
            
            float bump(float a, float b, float c, float f){
            return s(a, b, f) - s(b, c, f);
            }

            float mapLinear01(float x, float a1, float a2){
            float f = ( x - a1 ) / ( a2 - a1 );
            f = clamp(f, 0., 1.);
            return f;
            }
              
            // Noise Function
            float N31(vec3 p) {
            vec3 a = fract(vec3(p.xyz) * vec3(213.897, 653.453, 253.098));
            a += dot(a, a.yzx + 79.76);
            return fract((a.x + a.y) * a.z);
            }

            float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
            vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
            vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

            float noise(vec3 p){
                vec3 a = floor(p);
                vec3 d = p - a;
                d = d * d * (3.0 - 2.0 * d);

                vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
                vec4 k1 = perm(b.xyxy);
                vec4 k2 = perm(k1.xyxy + b.zzww);

                vec4 c = k2 + a.zzzz;
                vec4 k3 = perm(c);
                vec4 k4 = perm(c + 1.0);

                vec4 o1 = fract(k3 * (1.0 / 41.0));
                vec4 o2 = fract(k4 * (1.0 / 41.0));

                vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
                vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

                return o4.y * d.y + o4.x * (1.0 - d.y);
            }

              ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>

                vec3 pStart = positionStart;
                vec3 pEnd = position;

                float realDelay = positionDelay * delayRatio;
                float pureAction = 1.0 - delayRatio;
                float realAction = mapLinear01(action, realDelay, realDelay + pureAction);
                vRealAction = realAction;

                transformed = mix(pStart, pEnd, realAction);

                float slope = sin(realAction * PI);
                transformed.y += slope * distance(pStart, pEnd) * 0.5 * noise(pStart);

                vTint = length(transformed.xz) / ${particleRadius}.;
                `
            );

            shader.fragmentShader = `
                #define s(a, b, c) smoothstep(a, b, c)
                varying float vTint;
                varying float vRealAction;
                varying float vAmplitude;

                float bump(float a, float b, float c, float f){
                  return s(a, b, f) - s(b, c, f);
                }
                ${shader.fragmentShader}
            `
                .replace(
                    `#include <clipping_planes_fragment>`,
                    `
                #include <clipping_planes_fragment>`
                )
                .replace(
                    `#include <color_fragment>`,
                    `#include <color_fragment>
                `
                );
        }
    });
}

function fillWithPoints(mesh, count) {
    const ray = new THREE.Raycaster();
    ray.firstHitOnly = true;

    const meshInvMatrix = new THREE.Matrix4();
    meshInvMatrix.copy(mesh.matrixWorld).invert();
    const localRay = new THREE.Ray();

    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;
    const bsize = new THREE.Vector3();
    bbox.getSize(bsize);

    const points = [];
    const pointsStart = [];
    const pointsDelay = [];

    const dir = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const vps = new THREE.Vector3();
    let counter = 0;

    const offScreenRadius = Math.max(bsize.x, bsize.y, bsize.z) * .5;

    while (counter < count) {
        v.set(
            THREE.MathUtils.randFloat(bbox.min.x, bbox.max.x),
            THREE.MathUtils.randFloat(bbox.min.y, bbox.max.y),
            THREE.MathUtils.randFloat(bbox.min.z, bbox.max.z)
        );
        if (isInside(v)) {
            vps.setFromSphericalCoords(
                offScreenRadius, 
                Math.random() * Math.PI,
                Math.random() * Math.PI * 2
            );

            pointsStart.push(vps.x, vps.y, vps.z);
            pointsDelay.push((v.y - bbox.min.y) / bsize.y);

            points.push(v.x, v.y, v.z); 
            counter++;
        }
    }

    function isInside(v) {
        ray.set(v, dir);
        const intersects = ray.intersectObject(mesh);

        localRay.copy(ray.ray).applyMatrix4(meshInvMatrix);

        if (intersects.length > 0) {
            if (intersects[0].face.normal.dot(localRay.direction) > 0) return true;
        }
        return false;
    }

    return {
        positions: points,
        positionsStart: pointsStart,
        positionsDelay: pointsDelay
    };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    group.update(time * 2); 

    if (cameraProgress <= 1) {
        cameraProgress += cameraSpeed;
        if (cameraProgress > 1) cameraProgress = 1;

        const newCameraPosition = curve.getPoint(cameraProgress);
        camera.position.copy(newCameraPosition);

        const nextPoint = curve.getPoint((cameraProgress + 0.001) % 1);
        camera.lookAt(nextPoint);

    } else {
        camera.position.set(0, 0, 20);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    controls.update();
    renderer.render(scene, camera);
}
