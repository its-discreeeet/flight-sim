import * as THREE from 'three';

let scene, camera, renderer;
let planeMesh, groundMesh;
let clock = new THREE.Clock();
const cloudMeshes = []; 
const mountains = [];

const INITIAL_PLANE_Y = 1.5; 
const initialPlaneState = {
    position: new THREE.Vector3(0, INITIAL_PLANE_Y, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    orientation: new THREE.Quaternion(),
    throttle: 0,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
};

let planeState = { ...initialPlaneState }; 

const PHYSICS_PARAMS = {
    mass: 1000, 
    gravity: 9.81, 
    maxThrottleForce: 5000,   
    liftCoefficient: 9,       
    dragCoefficient: 0.8,     
    minSpeedForLift: 25,      
    
    pitchSpeed: 1.0,        
    rollSpeed: 1.5,         
    yawSpeed: 0.5,          

    stallAngleThresholdRad: 0.26, // Approx 15 degrees
    stallLiftMultiplier: 0.3,   
    
    aoaLiftGain: 1.5,           
    aoaLiftBonusMax: 0.6,      
    aoaLiftReductionMax: -0.4,  
    
    aoaDragGain: 2.0,           
    aoaDragBonusMax: 1.5,       
    
    rollingResistanceCoefficient: 0.03, 
    groundSteeringFactor: 0.5, 

    maxSpeed: 200,             
    maxAltitude: 500,      

    planeCollisionRadius: 7.5,  // Half wingspan approx. Tune this value!
    mountainCollisionElasticity: 0.4, 
};

const keysPressed = {};

const speedDisplay = document.getElementById('speedDisplay');
const altitudeDisplay = document.getElementById('altitudeDisplay');

init();
animate();

function resetPlane() {
    planeState = {
        ...initialPlaneState, 
        position: initialPlaneState.position.clone(), 
        velocity: initialPlaneState.velocity.clone(),
        orientation: initialPlaneState.orientation.clone(),
    };

    planeMesh.position.copy(planeState.position);
    planeMesh.quaternion.copy(planeState.orientation);
}


function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); 
    scene.fog = new THREE.Fog(0x87CEEB, 500, 4000); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 15000); 
    camera.position.set(0, initialPlaneState.position.y + 10, 25); 
    camera.lookAt(planeState.position);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(150, 300, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    scene.add(directionalLight);

    planeMesh = createPlaneMesh();
    planeMesh.castShadow = true;
    resetPlane(); 
    scene.add(planeMesh);

    const groundGeometry = new THREE.PlaneGeometry(10000, 10000); 
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, side: THREE.DoubleSide });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    createScenery();
    createClouds();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

function createPlaneMesh() {
    const planeGroup = new THREE.Group();
    const fuselageMaterial = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.6, roughness: 0.4 });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A0A0, metalness: 0.5, roughness: 0.5 });
    const fuselageGeometry = new THREE.BoxGeometry(2, 2, 10);
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    planeGroup.add(fuselage);
    const wingGeometry = new THREE.BoxGeometry(15, 0.5, 3);
    const mainWing = new THREE.Mesh(wingGeometry, wingMaterial);
    mainWing.position.z = -1;
    planeGroup.add(mainWing);
    const tailWingGeometry = new THREE.BoxGeometry(5, 0.3, 1.5);
    const tailWing = new THREE.Mesh(tailWingGeometry, wingMaterial);
    tailWing.position.z = 4; 
    tailWing.position.y = 0.5;
    planeGroup.add(tailWing);
    const vStabGeometry = new THREE.BoxGeometry(0.3, 2.5, 1.5);
    const vStab = new THREE.Mesh(vStabGeometry, wingMaterial);
    vStab.position.z = 4.5; 
    vStab.position.y = 1.5; 
    planeGroup.add(vStab);
    const cockpitGeo = new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMat = new THREE.MeshStandardMaterial({color: 0x446688, transparent: true, opacity: 0.7, metalness: 0.2, roughness: 0.1});
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.z = -3.5; 
    cockpit.position.y = 0.7;
    cockpit.rotation.x = Math.PI / 10;
    planeGroup.add(cockpit);
    const propGeo = new THREE.BoxGeometry(0.2, 3, 0.2);
    const propMat = new THREE.MeshStandardMaterial({color: 0x333333, metalness: 0.8, roughness: 0.2});
    const prop = new THREE.Mesh(propGeo, propMat);
    prop.position.z = -5.2; 
    planeGroup.add(prop);
    planeGroup.userData.propeller = prop;
    return planeGroup;
}

function createScenery() {
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 });


    for (let i = 0; i < 30; i++) {
        const coneRadius = Math.random() * 300 + 80; // This is the base radius
        const height = Math.random() * 800 + 150;
        const mountainGeometry = new THREE.ConeGeometry(coneRadius, height, Math.floor(Math.random() * 5) + 8);
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);

        mountain.position.x = (Math.random() - 0.5) * 8000;
        mountain.position.z = (Math.random() - 0.5) * 8000;
        mountain.position.y = height / 2 - 2;
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        mountain.userData.collisionRadius = coneRadius;

        scene.add(mountain);
        mountains.push(mountain); 
    }
}

function createClouds() {
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, flatShading: true });
    for (let i = 0; i < 25; i++) {
        const cloudGroup = new THREE.Group();
        const numPuffs = Math.floor(Math.random() * 5) + 3;
        for (let j = 0; j < numPuffs; j++) {
            const puffSize = Math.random() * 50 + 30;
            const puffGeometry = new THREE.SphereGeometry(puffSize, 8, 6);
            const puffMesh = new THREE.Mesh(puffGeometry, cloudMaterial);
            puffMesh.position.set((Math.random() - 0.5) * puffSize * 2.5, (Math.random() - 0.5) * puffSize * 0.5, (Math.random() - 0.5) * puffSize * 1.5);
            puffMesh.receiveShadow = false;
            cloudGroup.add(puffMesh);
        }
        cloudGroup.position.set((Math.random() - 0.5) * 7000, Math.random() * 500 + 600, (Math.random() - 0.5) * 7000 );
        cloudMeshes.push(cloudGroup);
        scene.add(cloudGroup);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    if (['w', 's', 'a', 'd', 'q', 'e', 'shift', 'control', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
    }
    if (key === 'r') {
        resetPlane();
    }
}

function onKeyUp(event) {
    keysPressed[event.key.toLowerCase()] = false;
}

function updatePlaneControls(deltaTime) {
    if (keysPressed['shift']) planeState.throttle = Math.min(1, planeState.throttle + deltaTime * 0.5);
    if (keysPressed['control']) planeState.throttle = Math.max(0, planeState.throttle - deltaTime * 0.5);
    planeState.pitchInput = 0;
    if (keysPressed['s'] || keysPressed['arrowdown']) planeState.pitchInput = 1;  
    if (keysPressed['w'] || keysPressed['arrowup']) planeState.pitchInput = -1; 
    planeState.rollInput = 0;
    if (keysPressed['d'] || keysPressed['arrowright']) planeState.rollInput = -1;   
    if (keysPressed['a'] || keysPressed['arrowleft']) planeState.rollInput = 1;  
    planeState.yawInput = 0;
    if (keysPressed['e']) planeState.yawInput = -1;    
    if (keysPressed['q']) planeState.yawInput = 1;   
}

function updatePlanePhysics(deltaTime) {
    const tempQuaternion = new THREE.Quaternion();
    const tempVector3 = new THREE.Vector3();

    // 1. apply rotations to orientation
    const currentOrientation = planeState.orientation;

    tempQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), planeState.pitchInput * PHYSICS_PARAMS.pitchSpeed * deltaTime);
    currentOrientation.multiply(tempQuaternion);

    tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), planeState.rollInput * PHYSICS_PARAMS.rollSpeed * deltaTime);
    currentOrientation.multiply(tempQuaternion);

    if (planeState.position.y > INITIAL_PLANE_Y + 0.1) { // Airborne yaw
        tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), planeState.yawInput * PHYSICS_PARAMS.yawSpeed * deltaTime);
        currentOrientation.multiply(tempQuaternion);
    }
    currentOrientation.normalize();

    // 2. calculate world vectors from orientation
    const worldForward = tempVector3.set(0, 0, -1).applyQuaternion(currentOrientation);
    const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentOrientation);
    // const worldRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentOrientation); 

    // 3. calculate forces
    const forces = new THREE.Vector3(0, 0, 0);
    let currentSpeed = planeState.velocity.length(); // Initial current speed

    // thrust
    const thrustForce = worldForward.clone().multiplyScalar(planeState.throttle * PHYSICS_PARAMS.maxThrottleForce);
    forces.add(thrustForce);

    // lift
    let liftForceMagnitude = 0;
    const isAirborne = planeState.position.y > INITIAL_PLANE_Y + 0.05;
    if (currentSpeed > PHYSICS_PARAMS.minSpeedForLift * 0.7) { 
        const pitchRelativeToHorizon = Math.asin(THREE.MathUtils.clamp(worldForward.y, -1, 1)); //positive is nose up basically :D

        let aoaFactor = 1.0 + THREE.MathUtils.clamp(
            pitchRelativeToHorizon * PHYSICS_PARAMS.aoaLiftGain,
            PHYSICS_PARAMS.aoaLiftReductionMax,
            PHYSICS_PARAMS.aoaLiftBonusMax
        );

        if (pitchRelativeToHorizon > PHYSICS_PARAMS.stallAngleThresholdRad && currentSpeed < PHYSICS_PARAMS.minSpeedForLift * 1.5) {
            aoaFactor *= PHYSICS_PARAMS.stallLiftMultiplier;
        }

        liftForceMagnitude = currentSpeed * currentSpeed * PHYSICS_PARAMS.liftCoefficient * aoaFactor;

        if (!isAirborne && currentSpeed < PHYSICS_PARAMS.minSpeedForLift) {
             liftForceMagnitude *= (currentSpeed / PHYSICS_PARAMS.minSpeedForLift);
        }
        liftForceMagnitude = Math.max(0, liftForceMagnitude); // Lift cannot be negative
        const liftForce = worldUp.clone().multiplyScalar(liftForceMagnitude);
        forces.add(liftForce);
    }

    // drag
    if (currentSpeed > 0.1) {
        const pitchRelativeToHorizon = Math.asin(THREE.MathUtils.clamp(worldForward.y, -1, 1));
        let dragAoaFactor = 1.0 + THREE.MathUtils.clamp(
            pitchRelativeToHorizon * PHYSICS_PARAMS.aoaDragGain,
            0, 
            PHYSICS_PARAMS.aoaDragBonusMax
        );

        let gearDragFactor = 1.0;
        if (!isAirborne || (planeState.position.y < INITIAL_PLANE_Y + 10 && currentSpeed < PHYSICS_PARAMS.minSpeedForLift * 1.2)) {
            gearDragFactor = 1.5;
        }
        const dragMagnitude = currentSpeed * currentSpeed * PHYSICS_PARAMS.dragCoefficient * dragAoaFactor * gearDragFactor;
        const dragForce = planeState.velocity.clone().normalize().multiplyScalar(-dragMagnitude);
        forces.add(dragForce);
    }

    // gravity
    const gravityForce = new THREE.Vector3(0, -PHYSICS_PARAMS.mass * PHYSICS_PARAMS.gravity, 0);
    forces.add(gravityForce);

    // 4. ground interaction
    let onGround = false;
    if (planeState.position.y + (planeState.velocity.y * deltaTime) <= INITIAL_PLANE_Y) {
        onGround = true;
        planeState.position.y = INITIAL_PLANE_Y;

        const liftYComponent = Math.max(0, worldUp.y * liftForceMagnitude);
        const normalForceScalar = Math.max(0, (PHYSICS_PARAMS.mass * PHYSICS_PARAMS.gravity) - liftYComponent);

        if (currentSpeed > 0.1) {
            const frictionMagnitude = PHYSICS_PARAMS.rollingResistanceCoefficient * normalForceScalar;
            const horizontalVelocity = tempVector3.set(planeState.velocity.x, 0, planeState.velocity.z);
            if (horizontalVelocity.lengthSq() > 0.01) {
                const rollingResistanceForce = horizontalVelocity.normalize().multiplyScalar(-frictionMagnitude);
                forces.add(rollingResistanceForce);
            }
        }

        if (planeState.velocity.y < -1.0) {
            planeState.velocity.y *= -0.1;
        } else {
            planeState.velocity.y = 0;
        }

        if (Math.abs(planeState.yawInput) > 0.01 && currentSpeed > 0.2) {
           const groundYawRate = planeState.yawInput * PHYSICS_PARAMS.yawSpeed * PHYSICS_PARAMS.groundSteeringFactor;
           tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), groundYawRate * deltaTime);
           currentOrientation.premultiply(tempQuaternion);
           currentOrientation.normalize();
        }

        const R = new THREE.Matrix4().makeRotationFromQuaternion(currentOrientation);
        const localUpOnGround = tempVector3.set(0,1,0).applyMatrix4(R);
        const angleWithWorldUp = localUpOnGround.angleTo(new THREE.Vector3(0,1,0));
        if (angleWithWorldUp > Math.PI / 12) {
            const targetForwardDir = new THREE.Vector3(0,0,-1).applyQuaternion(currentOrientation);
            targetForwardDir.y = 0;
            targetForwardDir.normalize();
            if (targetForwardDir.lengthSq() === 0) targetForwardDir.set(0,0,-1);
            const targetUpDir = new THREE.Vector3(0,1,0);
            tempQuaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), targetForwardDir, targetUpDir));
            currentOrientation.slerp(tempQuaternion, 0.15);
            currentOrientation.normalize();
        }
    }

    // 5. integrate Motion
    const acceleration = forces.divideScalar(PHYSICS_PARAMS.mass);
    planeState.velocity.add(acceleration.multiplyScalar(deltaTime));

    // --- SPEED CAP ---
    if (planeState.velocity.length() > PHYSICS_PARAMS.maxSpeed) {
        planeState.velocity.normalize().multiplyScalar(PHYSICS_PARAMS.maxSpeed);
    }
    // --- END SPEED CAP ---

    // update position based on (potentially capped) velocity
    if (!onGround) {
        planeState.position.add(planeState.velocity.clone().multiplyScalar(deltaTime));
    } else {
        planeState.position.x += planeState.velocity.x * deltaTime;
        planeState.position.z += planeState.velocity.z * deltaTime;
        // Y position already set to INITIAL_PLANE_Y if onGround
    }

    // --- ALTITUDE CAP ---
    const absoluteMaxAltitude = INITIAL_PLANE_Y + PHYSICS_PARAMS.maxAltitude;
    if (planeState.position.y > absoluteMaxAltitude) {
        planeState.position.y = absoluteMaxAltitude;
        if (planeState.velocity.y > 0) { // If moving upwards when hitting cap
            planeState.velocity.y = 0;    // Stop upward movement
        }
    }
    // --- END ALTITUDE CAP ---

     
        const planeCenter = planeState.position;
        const planeRadius = PHYSICS_PARAMS.planeCollisionRadius;
    
        for (const mountain of mountains) {
            const mountainCenter = mountain.position;
            const mountainRadius = mountain.userData.collisionRadius;
    
        
            const distanceVec = tempVector3.subVectors(planeCenter, mountainCenter);
            const distanceSq = distanceVec.lengthSq(); 
            const sumOfRadii = planeRadius + mountainRadius;
    
            if (distanceSq < sumOfRadii * sumOfRadii) { 
                const distance = Math.sqrt(distanceSq); 
               
                tempCollisionNormal.copy(distanceVec).divideScalar(distance); 
    
               
                const penetrationDepth = sumOfRadii - distance;
                planeState.position.add(tempCollisionNormal.clone().multiplyScalar(penetrationDepth + 0.01)); // Add small epsilon
    
                
                const vDotN = planeState.velocity.dot(tempCollisionNormal);
    
                if (vDotN < 0) { 
                    const impulseMagnitude = -(1 + PHYSICS_PARAMS.mountainCollisionElasticity) * vDotN;
                    const impulseVector = tempCollisionNormal.clone().multiplyScalar(impulseMagnitude);
                    planeState.velocity.add(impulseVector);
    
                    
                    if (planeState.velocity.length() > PHYSICS_PARAMS.maxSpeed) {
                        planeState.velocity.normalize().multiplyScalar(PHYSICS_PARAMS.maxSpeed);
                    }
                }
            
            }
        }
       

    // 6. update plane's mesh
    planeMesh.position.copy(planeState.position);
    planeMesh.quaternion.copy(currentOrientation);

    // animate propeller
    if (planeMesh.userData.propeller) {
     
        const finalSpeedForProp = planeState.velocity.length();
        const propSpeed = planeState.throttle * 35 + finalSpeedForProp * 0.25;
        planeMesh.userData.propeller.rotation.z -= propSpeed * deltaTime;
    }
}

function updateCamera() {
    const offset = new THREE.Vector3(0, 8, 22); 
    const worldOffset = offset.clone().applyQuaternion(planeState.orientation);
    const cameraTargetPosition = planeState.position.clone().add(worldOffset);
    camera.position.lerp(cameraTargetPosition, 0.07); 

    const lookAtPoint = planeState.position.clone();
    const lookOffset = new THREE.Vector3(0, 2, -15); 
    const worldLookOffset = lookOffset.applyQuaternion(planeState.orientation);
    lookAtPoint.add(worldLookOffset);
    camera.lookAt(lookAtPoint);
}

function updateUI() {
    speedDisplay.textContent = planeState.velocity.length().toFixed(1);
    altitudeDisplay.textContent = Math.max(0, planeState.position.y - INITIAL_PLANE_Y).toFixed(1);
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.05); 

    updatePlaneControls(deltaTime);
    updatePlanePhysics(deltaTime);
    updateCamera();
    updateUI();

    renderer.render(scene, camera);
}