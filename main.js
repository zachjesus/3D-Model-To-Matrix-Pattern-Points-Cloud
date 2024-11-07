import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    computeBoundsTree, disposeBoundsTree, acceleratedRaycast,
} from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const scene = new THREE.Scene();

var loader = new GLTFLoader();
loader.load(
    "./ModelofMyName.glb",
    function(gltf) {
        const model = gltf.scene.children[0];
        model.material.side = THREE.DoubleSide;
        model.material.normalMapType = THREE.ObjectSpaceNormalMap;

        model.rotateX(-Math.PI / 2);

        let geom = model.geometry;
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
        const scaleFactor = 1000;
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        scene.add(mesh);
        mesh.visible = false;

        const randomPoints = fillWithPoints(mesh, 3500); 

        // Separate points into two groups for texture0 and texture1
        const points0 = [];
        const points1 = [];
        for (let i = 0; i < randomPoints.length; i += 3) {
            if (Math.random() < 0.5) {
                points0.push(randomPoints[i], randomPoints[i + 1], randomPoints[i + 2]);
            } else {
                points1.push(randomPoints[i], randomPoints[i + 1], randomPoints[i + 2]);
            }
        }

        const pointsGeometry0 = new THREE.BufferGeometry();
        pointsGeometry0.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points0), 3));

        const pointsGeometry1 = new THREE.BufferGeometry();
        pointsGeometry1.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points1), 3));

        // Create a custom texture with green 1's
        const canvas1 = document.createElement('canvas');
        canvas1.width = 64;
        canvas1.height = 64;
        const context1 = canvas1.getContext('2d');
        context1.clearRect(0, 0, canvas1.width, canvas1.height);
        context1.fillStyle = 'green';
        context1.font = '48px Arial';
        context1.fillText('1', 10, 50);

        const texture1 = new THREE.CanvasTexture(canvas1);
        texture1.needsUpdate = true;

        // Create a custom texture with green 0's
        const canvas0 = document.createElement('canvas');
        canvas0.width = 64;
        canvas0.height = 64;
        const context0 = canvas0.getContext('2d');
        context0.clearRect(0, 0, canvas0.width, canvas0.height); 
        context0.fillStyle = 'green';
        context0.font = '48px Arial';
        context0.fillText('0', 10, 50);

        const texture0 = new THREE.CanvasTexture(canvas0);
        texture0.needsUpdate = true;

        const pointsMaterial0 = new THREE.PointsMaterial({ 
            size: 1, 
            sizeAttenuation: true,     
            map: texture0, 
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,          
            depthTest: true
        });

        const pointsMaterial1 = new THREE.PointsMaterial({ 
            size: 1, 
            sizeAttenuation: true,
            map: texture1, 
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: true
        });

        const pointsMesh0 = new THREE.Points(pointsGeometry0, pointsMaterial0);
        const pointsMesh1 = new THREE.Points(pointsGeometry1, pointsMaterial1);

        scene.add(pointsMesh0);
        scene.add(pointsMesh1);
    }
);

const camera = new THREE.PerspectiveCamera(
    75,                                     
    window.innerWidth / window.innerHeight,
    .01,                                  
    3000                                 
);
camera.position.set(0, 50, 50); 

const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});
renderer.setClearColor(0x000000, 0); 
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.25; 
controls.target.set(0, 0, 0); 

const particleRadius = 40; 

function fillWithPoints(mesh, count) {
    var ray = new THREE.Raycaster();
    ray.firstHitOnly = true;

    let meshInvMatrix = new THREE.Matrix4();
    meshInvMatrix.copy(mesh.matrixWorld).invert();
    let localRay = new THREE.Ray();

    mesh.geometry.computeBoundingBox();
    let bbox = mesh.geometry.boundingBox;
    let center = new THREE.Vector3();
    bbox.getCenter(center);
    let bsize = new THREE.Vector3();
    bbox.getSize(bsize);

    let points = [];
    let pointsStart = [];
    let pointsDelay = []; 

    var dir = new THREE.Vector3(0, 1, 0); 
    var v = new THREE.Vector3();
    var vps = new THREE.Vector3();
    let counter = 0;
    while (counter < count) {
        v.set(
            THREE.MathUtils.randFloat(bbox.min.x, bbox.max.x),
            THREE.MathUtils.randFloat(bbox.min.y, bbox.max.y),
            THREE.MathUtils.randFloat(bbox.min.z, bbox.max.z)
        );
        if (isInside(v)) {
            vps.setFromSphericalCoords(
                Math.random() * particleRadius,
                Math.random() * Math.PI,
                Math.random() * Math.PI * 2
            ).setY(bbox.min.y);
            pointsStart.push(vps.x, vps.y, vps.z);
            pointsDelay.push((v.y - bbox.min.y) / bsize.y);

            points.push(v.clone());
            counter++;
        }
    }

    function isInside(v) {
        ray.set(v, dir);
        let intersects = ray.intersectObjects([mesh]);
        localRay.copy(ray.ray).applyMatrix4(meshInvMatrix);
        console.log(`Intersections: ${intersects.length}`);

        if (intersects.length > 0) {
            const face = intersects[0].face;
            const direction = localRay.direction;

            if (face && direction) {
                const dotProd = face.normal.dot(direction);
                console.log(`Dot product: ${dotProd}`);
                if (dotProd > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    console.log(points);

    const flatPoints = [];
    for (let i = 0; i < points.length; i++) {
        flatPoints.push(points[i].x, points[i].y, points[i].z);
    }

    return new Float32Array(flatPoints);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', onWindowResize, false);
function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}