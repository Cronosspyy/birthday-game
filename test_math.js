import * as THREE from 'three';

const playerUp = new THREE.Vector3(0, 1, 0);
const playerForward = new THREE.Vector3(0, 0, 1);

// Left-handed (current code)
const tangentRightLeft = new THREE.Vector3().crossVectors(playerForward, playerUp).normalize();
const orthoForwardLeft = new THREE.Vector3().crossVectors(playerUp, tangentRightLeft).normalize();
const orientMatrixLeft = new THREE.Matrix4().makeBasis(tangentRightLeft, playerUp, orthoForwardLeft);
const qLeft = new THREE.Quaternion().setFromRotationMatrix(orientMatrixLeft);

// Right-handed (proposed code)
const tangentRightRight = new THREE.Vector3().crossVectors(playerUp, playerForward).normalize();
const orthoForwardRight = new THREE.Vector3().crossVectors(tangentRightRight, playerUp).normalize();
const orientMatrixRight = new THREE.Matrix4().makeBasis(tangentRightRight, playerUp, orthoForwardRight);
const qRight = new THREE.Quaternion().setFromRotationMatrix(orientMatrixRight);

console.log("LEFT-HANDED (Current):");
console.log("tangentRight:", tangentRightLeft);
console.log("orthoForward:", orthoForwardLeft);
console.log("orientMatrix determinant:", orientMatrixLeft.determinant());
console.log("Quaternion:", qLeft);

console.log("\nRIGHT-HANDED (Proposed):");
console.log("tangentRight:", tangentRightRight);
console.log("orthoForward:", orthoForwardRight);
console.log("orientMatrix determinant:", orientMatrixRight.determinant());
console.log("Quaternion:", qRight);
