const viewer = document.getElementById('viewer');
const selectedEl = document.getElementById('selected');
const customColor = document.getElementById('customColor');
const groupButtons = document.getElementById('groupButtons');
const legend = document.getElementById('legend');
const modelTitle = document.getElementById('modelTitle');
const modelDescription = document.getElementById('modelDescription');

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
camera.position.set(8, -8, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minZoom = 0.72;
controls.maxZoom = 2.4;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a74, 0.62));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(5, -7, 8);
scene.add(key);
const fill = new THREE.DirectionalLight(0xd7f5ff, 0.28);
fill.position.set(-5, 4, 2);
scene.add(fill);

const root = new THREE.Group();
scene.add(root);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const edge = 4;
const center = [0.5, 0.5, 0.5];
const stickRadius = 0.14;
const stickMaterial = new THREE.MeshStandardMaterial({ color: '#9aa7ad', roughness: 0.68, metalness: 0.01 });

const swatchColors = ['#2f8da2', '#e4a13a', '#6a8f3d', '#c8553d', '#7b5bb7', '#2d3337', '#ffffff', '#f2cf63', '#78b7c5', '#f08a5d'];
const models = {
  diamond: {
    title: '金刚石晶胞互动模型',
    description: '拖动旋转，滚轮缩放，点击任意碳原子换色。碳原子形成四面体共价键网络。',
    camera: [8, -8, 8],
    viewSize: 8.9,
    groups: {
      corner: { label: '顶点碳原子', symbol: 'C', color: '#2f8da2', radius: 0.52 },
      face: { label: '面心碳原子', symbol: 'C', color: '#2f8da2', radius: 0.52 },
      internal: { label: '内部碳原子', symbol: 'C', color: '#2f8da2', radius: 0.52 }
    },
    legend: [
      ['#2f8da2', 'C：顶点、面心、内部原子', '18 个可见'],
      ['#9aa7ad', '共价键和晶胞棱', '同色同粗']
    ],
    atoms: [
      ...corners().map((frac, i) => atom(frac, 'corner', i + 1)),
      ...faces().map((frac, i) => atom(frac, 'face', i + 9)),
      ...[[.25,.25,.25],[.25,.75,.75],[.75,.25,.75],[.75,.75,.25]].map((frac, i) => atom(frac, 'internal', i + 15))
    ],
    bondTest: (a, b) => Math.abs(distance(a.frac, b.frac) - Math.sqrt(3)) < 0.0001
  },
  fluorite: {
    title: '氟化钙晶胞互动模型',
    description: '拖动旋转，滚轮缩放，点击任意离子换色。Ca2+ 构成面心立方点阵，F- 位于 8 个四面体空隙。',
    camera: [8, -8, 8],
    viewSize: 8.9,
    groups: {
      calcium: { label: 'Ca2+ 钙离子', symbol: 'Ca', color: '#2b6fa8', radius: 0.46 },
      fluorine: { label: 'F- 氟离子', symbol: 'F', color: '#5f9f3a', radius: 0.32 }
    },
    legend: [
      ['#2b6fa8', 'Ca2+：面心立方点阵', '14 个可见'],
      ['#5f9f3a', 'F-：四面体空隙', '8 个'],
      ['#9aa7ad', 'Ca-F 键和晶胞棱', '同色同粗']
    ],
    atoms: [
      ...corners().map((frac, i) => atom(frac, 'calcium', i + 1)),
      ...faces().map((frac, i) => atom(frac, 'calcium', i + 9)),
      ...tetraSites().map((frac, i) => atom(frac, 'fluorine', i + 1))
    ],
    bondTest: (a, b) => a.group !== b.group && Math.abs(distance(a.frac, b.frac) - Math.sqrt(3)) < 0.0001
  }
};

let activeModel = null;
let atomMeshes = [];
let atoms = [];
let selectedAtom = null;
let bondGroup = new THREE.Group();
let frameGroup = new THREE.Group();

function corners() {
  const out = [];
  [0, 1].forEach(x => [0, 1].forEach(y => [0, 1].forEach(z => out.push([x, y, z]))));
  return out;
}

function faces() {
  return [[0,.5,.5], [1,.5,.5], [.5,0,.5], [.5,1,.5], [.5,.5,0], [.5,.5,1]];
}

function tetraSites() {
  const out = [];
  [.25, .75].forEach(x => [.25, .75].forEach(y => [.25, .75].forEach(z => out.push([x, y, z]))));
  return out;
}

function atom(frac, group, index) {
  return { frac, group, index };
}

function point(frac) {
  return new THREE.Vector3(edge * (frac[0] - center[0]), edge * (frac[1] - center[1]), edge * (frac[2] - center[2]));
}

function distance(a, b) {
  return Math.hypot(edge * (a[0] - b[0]), edge * (a[1] - b[1]), edge * (a[2] - b[2]));
}

function cylinderBetween(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 28), material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.geometry && child.geometry.dispose();
    if (child.material && child.material !== stickMaterial) child.material.dispose();
  }
}

function resetSelectionText() {
  selectedEl.innerHTML = '<strong>未选中粒子</strong><br><span class="muted">点击任意球体后可单独换色。</span>';
}

function clearHighlight() {
  if (!selectedAtom) return;
  selectedAtom.mesh.scale.setScalar(1);
  selectedAtom.mesh.material.emissive.set('#000000');
  selectedAtom.mesh.material.emissiveIntensity = 0;
}

function selectAtom(atomData) {
  clearHighlight();
  selectedAtom = atomData;
  if (!atomData) {
    resetSelectionText();
    return;
  }
  const group = activeModel.groups[atomData.group];
  atomData.mesh.scale.setScalar(1.14);
  atomData.mesh.material.emissive.copy(atomData.mesh.material.color);
  atomData.mesh.material.emissiveIntensity = 0.18;
  customColor.value = atomData.color;
  selectedEl.innerHTML = `<strong>${group.symbol} ${String(atomData.index).padStart(2, '0')} · ${group.label}</strong><br><span class="muted">分数坐标 (${atomData.frac.map(v => v.toFixed(2)).join(', ')})</span>`;
}

function setAtomColor(atomData, color) {
  atomData.color = color;
  atomData.mesh.material.color.set(color);
  if (selectedAtom === atomData) customColor.value = color;
}

function loadModel(id) {
  activeModel = models[id];
  clearHighlight();
  selectedAtom = null;
  resetSelectionText();
  clearGroup(root);
  atomMeshes = [];
  atoms = activeModel.atoms.map(item => ({ ...item }));
  bondGroup = new THREE.Group();
  frameGroup = new THREE.Group();
  root.add(bondGroup);
  root.add(frameGroup);

  modelTitle.textContent = activeModel.title;
  modelDescription.textContent = activeModel.description;
  document.title = activeModel.title;
  camera.position.set(...activeModel.camera);
  camera.lookAt(0, 0, 0);

  atoms.forEach(item => {
    const group = activeModel.groups[item.group];
    const material = new THREE.MeshStandardMaterial({
      color: group.color,
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: 0.62,
      metalness: 0.02
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(group.radius, 48, 28), material);
    mesh.position.copy(point(item.frac));
    mesh.userData.atom = item;
    item.mesh = mesh;
    item.color = group.color;
    atomMeshes.push(mesh);
    root.add(mesh);
  });

  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      if (activeModel.bondTest(atoms[i], atoms[j])) {
        bondGroup.add(cylinderBetween(atoms[i].mesh.position, atoms[j].mesh.position, stickRadius, stickMaterial));
      }
    }
  }

  const cornerPoints = corners().map(point);
  for (let i = 0; i < cornerPoints.length; i++) {
    for (let j = i + 1; j < cornerPoints.length; j++) {
      if (Math.abs(cornerPoints[i].distanceTo(cornerPoints[j]) - edge) < 0.0001) {
        frameGroup.add(cylinderBetween(cornerPoints[i], cornerPoints[j], stickRadius, stickMaterial));
      }
    }
  }

  bondGroup.visible = document.getElementById('showBonds').checked;
  frameGroup.visible = document.getElementById('showFrame').checked;
  renderGroupButtons(id);
  renderLegend();
  document.getElementById('modelDiamond').setAttribute('aria-pressed', id === 'diamond');
  document.getElementById('modelFluorite').setAttribute('aria-pressed', id === 'fluorite');
  resize();
}

function renderGroupButtons(modelId) {
  groupButtons.innerHTML = '';
  Object.entries(activeModel.groups).forEach(([groupId, group]) => {
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = group.label.replace(/ .*/, '');
    button.addEventListener('click', () => atoms.filter(item => item.group === groupId).forEach(item => setAtomColor(item, group.color)));
    groupButtons.appendChild(button);
  });
  const reset = document.createElement('button');
  reset.className = 'btn primary';
  reset.type = 'button';
  reset.textContent = '恢复默认';
  reset.addEventListener('click', () => atoms.forEach(item => setAtomColor(item, activeModel.groups[item.group].color)));
  groupButtons.appendChild(reset);
}

function renderLegend() {
  legend.innerHTML = activeModel.legend.map(([color, label, count]) =>
    `<div class="legend-row"><span class="dot" style="background:${color}"></span><span>${label}</span><span class="muted">${count}</span></div>`
  ).join('');
}

function handlePick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(atomMeshes, false)[0];
  selectAtom(hit ? hit.object.userData.atom : null);
}

renderer.domElement.addEventListener('pointerdown', event => {
  renderer.domElement.dataset.downX = event.clientX;
  renderer.domElement.dataset.downY = event.clientY;
});

renderer.domElement.addEventListener('pointerup', event => {
  const dx = Math.abs(event.clientX - Number(renderer.domElement.dataset.downX || 0));
  const dy = Math.abs(event.clientY - Number(renderer.domElement.dataset.downY || 0));
  if (dx < 5 && dy < 5) handlePick(event);
});

swatchColors.forEach(color => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'swatch';
  button.style.background = color;
  button.setAttribute('aria-label', `使用颜色 ${color}`);
  button.addEventListener('click', () => selectedAtom && setAtomColor(selectedAtom, color));
  document.getElementById('swatches').appendChild(button);
});

customColor.addEventListener('input', () => selectedAtom && setAtomColor(selectedAtom, customColor.value));
document.getElementById('showFrame').addEventListener('change', event => frameGroup.visible = event.target.checked);
document.getElementById('showBonds').addEventListener('change', event => bondGroup.visible = event.target.checked);
document.getElementById('stickColor').addEventListener('input', event => stickMaterial.color.set(event.target.value));
document.getElementById('modelDiamond').addEventListener('click', () => loadModel('diamond'));
document.getElementById('modelFluorite').addEventListener('click', () => loadModel('fluorite'));

function resize() {
  const rect = document.querySelector('.stage').getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  const aspect = rect.width / rect.height;
  const viewSize = activeModel ? activeModel.viewSize : 8.9;
  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
loadModel('diamond');

function animate() {
  requestAnimationFrame(animate);
  if (document.getElementById('autoRotate').checked) root.rotation.z += 0.006;
  controls.update();
  renderer.render(scene, camera);
}

animate();
