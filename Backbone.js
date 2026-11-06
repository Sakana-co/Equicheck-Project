/**
 * EquiCheck: Web-Based Laboratory Room Equipment Monitoring & Damage Reporting System
 * Logic supporting Student, Instructor, and Property Custodian Modules with Cloud Firestore
 */

// ===== Custom pop-ups (replace the browser's alert / confirm) =====
const POPUP_TYPES = {
  success: { icon: '\u2713', title: 'SUCCESS' },
  error:   { icon: '\u2715', title: 'ERROR' },
  warning: { icon: '!',      title: 'NOTICE' },
  info:    { icon: 'i',      title: 'INFO' }
};
const popupQueue = [];
let popupBusy = false;

function showAppPopup(opts) {
  return new Promise(resolve => {
    popupQueue.push({ ...opts, resolve });
    runPopupQueue();
  });
}

function runPopupQueue() {
  if (popupBusy || popupQueue.length === 0) return;
  popupBusy = true;
  const p = popupQueue.shift();
  const type = POPUP_TYPES[p.type] ? p.type : 'info';
  const overlay = document.getElementById('appPopup');
  const win = document.getElementById('appPopupWindow');
  const okBtn = document.getElementById('appPopupOk');
  const cancelBtn = document.getElementById('appPopupCancel');

  win.className = `modal-window app-popup app-popup-${type}`;
  document.getElementById('appPopupIcon').textContent = POPUP_TYPES[type].icon;
  document.getElementById('appPopupTitle').textContent = p.title || POPUP_TYPES[type].title;
  document.getElementById('appPopupMessage').textContent = p.message;
  okBtn.textContent = p.confirmText || 'OK';
  okBtn.className = p.danger ? 'btn btn-danger' : 'btn btn-primary';
  cancelBtn.textContent = p.cancelText || 'CANCEL';
  cancelBtn.style.display = p.isConfirm ? '' : 'none';

  const close = (result) => {
    overlay.classList.remove('active');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
    document.removeEventListener('keydown', onKey);
    popupBusy = false;
    p.resolve(result);
    runPopupQueue();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close(!p.isConfirm);
  };

  okBtn.onclick = () => close(true);
  cancelBtn.onclick = () => close(false);
  document.addEventListener('keydown', onKey);
  overlay.classList.add('active');
  okBtn.focus();
}

function appAlert(message, opts = {}) {
  return showAppPopup({ message, ...opts });
}

function appConfirm(message, opts = {}) {
  return showAppPopup({ message, isConfirm: true, type: 'warning', ...opts });
}

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB94c2ufJtbetLZsR7LNSW72sc0228PalM",
  authDomain: "webdev-database-1ece0.firebaseapp.com",
  projectId: "webdev-database-1ece0",
  storageBucket: "webdev-database-1ece0.firebasestorage.app",
  messagingSenderId: "299058337228",
  appId: "1:299058337228:web:6a40ea9aa6a2597059b969"
};

// 2. Initialize Firebase and Firestore Database
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function compressImage(base64Str, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

// Laboratory configuration
const LAB_ROOMS = [
  { id: 'C401', name: 'C401', status: 'Available' },
  { id: 'C402', name: 'C402', status: 'Available' },
  { id: 'C403', name: 'C403', status: 'Available' },
  { id: 'C404', name: 'C404', status: 'Available' },
  { id: 'C405', name: 'C405', status: 'Available' },
  { id: 'R421', name: 'R421', status: 'Available' },
  { id: 'R422', name: 'R422', status: 'Being Fixed' },
  { id: 'L501', name: 'L501 (Left-wing Cisco Lab)', status: 'Being Updated' },
  { id: 'R501', name: 'R501 (Right-wing Cisco Lab)', status: 'Available' }
];

const PERIPHERALS = [
  { id: 'monitor', name: 'Monitor', iconKey: 'monitor' },
  { id: 'system_unit', name: 'System Unit', iconKey: 'system_unit' },
  { id: 'ups', name: 'Uninterruptible Power Supply (UPS)', iconKey: 'ups' },
  { id: 'keyboard', name: 'Keyboard', iconKey: 'keyboard' },
  { id: 'mouse', name: 'Mouse', iconKey: 'mouse' },
  { id: 'mousepad', name: 'Mousepad', iconKey: 'mousepad' }
];

const PERIPHERAL_ISSUES = {
  monitor: [
    'None',
    'Dust / Dirt build-up',
    'Does not turn on',
    'Dead display',
    'Crashes and freezes',
    'No/Slow Internet connectivity'
  ],
  system_unit: [
    'None',
    'Dust / Dirt build-up',
    'Does not turn on',
    'Loud fans',
    'Ports not working',
    'Overheating'
  ],
  ups: [
    'None',
    'Dust / Dirt build-up',
    'Does not turn on',
    'Loud fans',
    'Ports not working',
    'Overheating'
  ],
  keyboard: [
    'None',
    'Dust / Dirt build-up',
    'Does not connect',
    'Key(s) not functioning',
    'Ports not working',
    'Missing charging cable'
  ],
  mouse: [
    'None',
    'Dust / Dirt build-up',
    'Does not connect',
    'Button(s) not functioning',
    'Missing charging cable'
  ],
  mousepad: [
    'None',
    'Dust / Dirt build-up'
  ]
};

const ICONS = {
  monitor: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="12" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="15" x2="12" y2="21"/></svg>`,
  system_unit: `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="1"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="9" x2="16" y2="9"/><circle cx="12" cy="16" r="2"/></svg>`,
  ups: `<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><polygon points="13 7 9 13 14 13 11 19 16 12 12 12 13 7"/></svg>`,
  keyboard: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="5" y1="9" x2="7" y2="9"/><line x1="9" y1="9" x2="11" y2="9"/><line x1="13" y1="9" x2="15" y2="9"/><line x1="17" y1="9" x2="19" y2="9"/><line x1="7" y1="15" x2="17" y2="15"/></svg>`,
  mouse: `<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="3" x2="12" y2="9"/><path d="M12 21 C12 23, 10 24, 8 24"/></svg>`,
  mousepad: `<svg viewBox="0 0 24 24"><path d="M4 4 h12 l4 4 v12 h-16 z"/><line x1="16" y1="4" x2="16" y2="8"/><line x1="16" y1="8" x2="20" y2="8"/></svg>`
};

const state = {
  currentUserType: null,
  // Cached authentication accounts synchronized with Firestore
  auth: {
    instructor: {
      email: 'admin@tsu.edu.ph',
      password: 'admin123'
    },
    custodian: {
      email: 'custodian@tsu.edu.ph',
      password: 'custodian123'
    }
  },
  studentDetails: {
    studentNo: '2024101234',
    studentName: 'Palad, Franzen R.',
    section: 'BSIT-2A',
    evalDate: new Date().toISOString().split('T')[0],
    classSchedule: '10:30 AM - 1:30 PM',
    instructorName: 'John Cedric G. Asprer'
  },
  selectedRoom: 'C401',
  selectedPc: 1,
  activePeripheralId: 'monitor',
  currentRating: 5,
  currentPcEvaluations: {},
  roomStatuses: {},
  submittedRecords: [
    {
      id: 'REC-001',
      room: 'C404',
      pcNo: 35,
      status: 'functional',
      verificationStatus: 'Pending',
      issuesSummary: 'None',
      affectedDevices: 'None',
      timestamp: '09/08/2026, 11:45 AM',
      studentNo: '202350123456',
      studentName: 'Santos, Rhein Justin',
      section: 'WMA-3A',
      evaluations: {}
    },
    {
      id: 'REC-002',
      room: 'C404',
      pcNo: 21,
      status: 'unusable',
      verificationStatus: 'Denied',
      issuesSummary: 'Dead display, Loose cable',
      affectedDevices: 'Monitor, System Unit',
      timestamp: '09/08/2026, 11:40 AM',
      studentNo: '2024001003',
      studentName: 'Tolentino, Kurt Hans',
      section: 'WMA-3A',
      evaluations: {}
    },
    {
      id: 'REC-003',
      room: 'C404',
      pcNo: 23,
      status: 'semi',
      verificationStatus: 'Approved',
      issuesSummary: 'Sticky Keys',
      affectedDevices: 'Keyboard',
      timestamp: '09/08/2026, 11:32 AM',
      studentNo: '2024002005',
      studentName: 'Sapasap, Phoemela',
      section: 'WMA-3A',
      evaluations: {}
    }
  ]
};

LAB_ROOMS.forEach(r => { state.roomStatuses[r.id] = r.status; });

const views = {
  splash: document.getElementById('view-splash'),
  evaluatorDetails: document.getElementById('view-evaluator-details'),
  roomSelection: document.getElementById('view-room-selection'),
  pcSelection: document.getElementById('view-pc-selection'),
  peripheralSelection: document.getElementById('view-peripheral-selection'),
  conditionForm: document.getElementById('view-condition-form'),
  reportSummary: document.getElementById('view-report-summary'),
  instructorLogin: document.getElementById('view-instructor-login'),
  instructorDashboard: document.getElementById('view-instructor-dashboard'),
  custodianLogin: document.getElementById('view-custodian-login'),
  custodianDashboard: document.getElementById('view-custodian-dashboard')
};

const navBackBtn = document.getElementById('globalBackBtn');
let viewHistory = ['view-splash'];

function navigateTo(viewId) {
  Object.keys(views).forEach(key => views[key]?.classList.remove('active'));
  const target = views[viewId] || document.getElementById(viewId);
  if (target) target.classList.add('active');
  if (viewHistory[viewHistory.length - 1] !== viewId) viewHistory.push(viewId);
  
  const isTopLevel = (viewId === 'view-splash' || viewId === 'view-instructor-dashboard' || viewId === 'view-custodian-dashboard');
  navBackBtn.style.visibility = isTopLevel ? 'hidden' : 'visible';
}

function goBack() {
  const instructorForm = document.getElementById('formInstructorLogin');
  if (instructorForm) instructorForm.reset();
  const custodianForm = document.getElementById('formCustodianLogin');
  if (custodianForm) custodianForm.reset();

  if (viewHistory.length > 1) {
    viewHistory.pop();
    const prevView = viewHistory[viewHistory.length - 1];
    Object.keys(views).forEach(key => views[key]?.classList.remove('active'));
    document.getElementById(prevView)?.classList.add('active');
    const isTopLevel = (prevView === 'view-splash' || prevView === 'view-instructor-dashboard' || prevView === 'view-custodian-dashboard');
    navBackBtn.style.visibility = isTopLevel ? 'hidden' : 'visible';
  }
}

// Fetch live records, room statuses, and persistent accounts from Firestore
async function loadReportsFromFirestore() {
  try {
    const snapshot = await db.collection('reports').get();
    if (!snapshot.empty) {
      const cloudRecords = [];
      snapshot.forEach(doc => {
        const item = doc.data();
        item.id = doc.id;
        cloudRecords.push(item);
      });
      state.submittedRecords = cloudRecords;
      renderSeatsMatrix();
      if (typeof updateDashboardData === 'function') updateDashboardData();
      if (typeof updateCustodianDashboard === 'function') updateCustodianDashboard();
    }
  } catch (err) {
    console.warn('Could not pull reports from Firestore:', err);
  }

  try {
    const roomSnap = await db.collection('room_statuses').get();
    if (!roomSnap.empty) {
      roomSnap.forEach(doc => {
        const d = doc.data();
        if (d.status) state.roomStatuses[doc.id] = d.status;
      });
      renderRooms();
      renderCustodianRoomManagement();
    }
  } catch (err) {
    console.warn('Could not pull room statuses from Firestore:', err);
  }

  // Load persistent credentials from Cloud Firestore
  try {
    const accountsSnap = await db.collection('accounts').get();
    if (!accountsSnap.empty) {
      accountsSnap.forEach(doc => {
        if (state.auth[doc.id]) {
          state.auth[doc.id] = { ...state.auth[doc.id], ...doc.data() };
        }
      });
    } else {
      // First-time setup: initialize defaults in Firestore if collection is empty
      await db.collection('accounts').doc('instructor').set(state.auth.instructor);
      await db.collection('accounts').doc('custodian').set(state.auth.custodian);
    }
  } catch (err) {
    console.warn('Could not sync accounts from Firestore:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderRooms();
  renderSeatsMatrix();
  renderPeripheralsHub();
  resetEvaluationsData();
  loadReportsFromFirestore();
});

function initEventListeners() {
  navBackBtn.addEventListener('click', goBack);

  // Splash navigation (3 modules)
  document.getElementById('btnGoStudent').addEventListener('click', () => {
    state.currentUserType = 'student';
    document.getElementById('studentNo').value = state.studentDetails.studentNo;
    document.getElementById('studentName').value = state.studentDetails.studentName;
    document.getElementById('section').value = state.studentDetails.section;
    document.getElementById('evalDate').value = state.studentDetails.evalDate;
    document.getElementById('classSchedule').value = state.studentDetails.classSchedule;
    document.getElementById('instructorSelect').value = state.studentDetails.instructorName;
    navigateTo('view-evaluator-details');
  });

  document.querySelectorAll('#starRatingContainer .star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.value);
      setStarRating(val);
    });
  });

  document.getElementById('btnGoInstructor').addEventListener('click', () => {
    state.currentUserType = 'instructor';
    navigateTo('view-instructor-login');
  });

  document.getElementById('btnGoCustodian').addEventListener('click', () => {
    state.currentUserType = 'custodian';
    navigateTo('view-custodian-login');
  });

  // Evaluator Details submit
  document.getElementById('formEvaluatorDetails').addEventListener('submit', (e) => {
    e.preventDefault();
    state.studentDetails = {
      studentNo: document.getElementById('studentNo').value,
      studentName: document.getElementById('studentName').value,
      section: document.getElementById('section').value,
      evalDate: document.getElementById('evalDate').value,
      classSchedule: document.getElementById('classSchedule').value,
      instructorName: document.getElementById('instructorSelect').value
    };
    navigateTo('view-room-selection');
  });

  // Peripheral assessment
  document.getElementById('btnSavePeripheral').addEventListener('click', saveCurrentPeripheralEvaluation);
  document.getElementById('btnResetPeripheral').addEventListener('click', resetCurrentPeripheralForm);
  document.getElementById('btnFinishInspection').addEventListener('click', populateAndGoToSummary);
  document.getElementById('btnReviewAllFromForm').addEventListener('click', populateAndGoToSummary);
  document.getElementById('btnBackToHub').addEventListener('click', () => navigateTo('view-peripheral-selection'));
  document.getElementById('pledgeCheckbox').addEventListener('change', (e) => {
    document.getElementById('btnSubmitFinalReport').disabled = !e.target.checked;
  });
  document.getElementById('btnEditEvaluation').addEventListener('click', () => {
    navigateTo('view-evaluator-details');
  });
  document.getElementById('btnSubmitFinalReport').addEventListener('click', submitFinalReport);

  // Instructor Login - STRICT AUTHENTICATION
  document.getElementById('formInstructorLogin').addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const email = emailInput.value.trim();
    const pass = passInput.value;

    if (email === state.auth.instructor.email && pass === state.auth.instructor.password) {
      emailInput.value = '';
      passInput.value = '';
      updateDashboardData();
      navigateTo('view-instructor-dashboard');
    } else {
      appAlert('Invalid instructor credentials.', { type: 'error', title: 'LOGIN FAILED' });
    }
  });

  document.getElementById('btnDashLogout').addEventListener('click', () => {
    document.getElementById('formInstructorLogin').reset();
    state.currentUserType = null;
    navigateTo('view-splash');
  });

  document.getElementById('btnDashAccount').addEventListener('click', () => {
    document.getElementById('formChangePassword').reset();
    document.getElementById('accountSettingModal').classList.add('active');
  });

  document.getElementById('instructorSectionFilterList').addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      document.querySelectorAll('#instructorSectionFilterList li').forEach(li => li.classList.remove('active'));
      e.target.classList.add('active');
      filterInstructorBySection(e.target.dataset.section);
    }
  });

  // Custodian Login - STRICT AUTHENTICATION
  document.getElementById('formCustodianLogin').addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('custodianEmail');
    const passInput = document.getElementById('custodianPassword');
    const email = emailInput.value.trim();
    const pass = passInput.value;

    if (email === state.auth.custodian.email && pass === state.auth.custodian.password) {
      emailInput.value = '';
      passInput.value = '';
      updateCustodianDashboard();
      navigateTo('view-custodian-dashboard');
    } else {
      appAlert('Invalid custodian credentials.', { type: 'error', title: 'LOGIN FAILED' });
    }
  });

  document.getElementById('btnCustLogout').addEventListener('click', () => {
    document.getElementById('formCustodianLogin').reset();
    state.currentUserType = null;
    navigateTo('view-splash');
  });

  document.getElementById('btnCustAccount').addEventListener('click', () => {
    document.getElementById('formChangePassword').reset();
    document.getElementById('accountSettingModal').classList.add('active');
  });

  // Custodian Tab Switches
  document.getElementById('btnCustTabReports').addEventListener('click', () => {
    document.getElementById('btnCustTabReports').classList.add('btn-primary');
    document.getElementById('btnCustTabReports').classList.remove('btn-secondary');
    document.getElementById('btnCustTabRooms').classList.add('btn-secondary');
    document.getElementById('btnCustTabRooms').classList.remove('btn-primary');
    document.getElementById('custKpiGrid').style.display = 'grid';
    document.getElementById('custodianReportsCard').style.display = 'block';
    document.getElementById('custRoomFilterWrapper').style.display = 'block';
    document.getElementById('custodianRoomsCard').style.display = 'none';
  });

  document.getElementById('btnCustTabRooms').addEventListener('click', () => {
    document.getElementById('btnCustTabRooms').classList.add('btn-primary');
    document.getElementById('btnCustTabRooms').classList.remove('btn-secondary');
    document.getElementById('btnCustTabReports').classList.add('btn-secondary');
    document.getElementById('btnCustTabReports').classList.remove('btn-primary');
    document.getElementById('custKpiGrid').style.display = 'none';
    document.getElementById('custodianReportsCard').style.display = 'none';
    document.getElementById('custRoomFilterWrapper').style.display = 'none';
    document.getElementById('custodianRoomsCard').style.display = 'block';
    renderCustodianRoomManagement();
  });

  document.getElementById('custodianRoomFilterList').addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      document.querySelectorAll('#custodianRoomFilterList li').forEach(li => li.classList.remove('active'));
      e.target.classList.add('active');
      filterCustodianByRoom(e.target.dataset.room);
    }
  });

  document.getElementById('btnCustSavePdf').addEventListener('click', exportReportsToPdf);
  document.getElementById('btnDownloadReportPdf').addEventListener('click', () => {
    downloadReportPdf(currentViewedRecord);
  });
  document.getElementById('btnDeleteReport').addEventListener('click', () => {
    deleteViewedReport(currentViewedRecord);
  });

  // Password Update Modal - SYNCS DIRECTLY WITH FIRESTORE
  document.getElementById('btnCloseAccountModal').addEventListener('click', () => {
    document.getElementById('formChangePassword').reset();
    document.getElementById('accountSettingModal').classList.remove('active');
  });

  document.getElementById('formChangePassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('currentPassword').value;
    const np = document.getElementById('newPassword').value;
    const cnp = document.getElementById('confirmNewPassword').value;

    const activeRole = state.currentUserType === 'custodian' ? 'custodian' : 'instructor';

    if (currentPass !== state.auth[activeRole].password) {
      appAlert('Incorrect current password.', { type: 'error', title: 'AUTHENTICATION FAILED' });
      return;
    }

    if (np !== cnp) {
      appAlert('New passwords do not match.', { type: 'error', title: 'PASSWORD ERROR' });
      return;
    }

    if (np.length < 6) {
      appAlert('Password must be at least 6 characters long.', { type: 'warning', title: 'PASSWORD TOO SHORT' });
      return;
    }

    try {
      // Save permanently to Firestore 'accounts' collection
      await db.collection('accounts').doc(activeRole).set(
        { password: np },
        { merge: true }
      );

      state.auth[activeRole].password = np;
      appAlert(`Password for ${activeRole.toUpperCase()} updated and saved to cloud!`, { type: 'success', title: 'PASSWORD UPDATED' });
      document.getElementById('formChangePassword').reset();
      document.getElementById('accountSettingModal').classList.remove('active');
    } catch (err) {
      console.error('Failed to update password in Firestore:', err);
      appAlert('Failed to save updated password: ' + err.message, { type: 'error', title: 'UPDATE FAILED' });
    }
  });

  // Modals close buttons
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('reportDetailModal').classList.remove('active');
  });
  document.getElementById('btnCloseVerifyModal').addEventListener('click', () => {
    document.getElementById('instructorVerifyModal').classList.remove('active');
  });
  document.getElementById('btnCloseRoomStatusModal').addEventListener('click', () => {
    document.getElementById('editRoomStatusModal').classList.remove('active');
  });
  document.getElementById('btnCancelRoomStatus').addEventListener('click', () => {
    document.getElementById('editRoomStatusModal').classList.remove('active');
  });

  const btnCloseImageModal = document.getElementById('btnCloseImageModal');
  if (btnCloseImageModal) {
    btnCloseImageModal.addEventListener('click', () => {
      document.getElementById('imagePreviewModal').classList.remove('active');
    });
  }

  // Number rating buttons (1 to 5)
  document.querySelectorAll('#numRatingContainer .num-box').forEach(box => {
    box.addEventListener('click', () => {
      const val = parseInt(box.dataset.value);
      setStarRating(val);
    });
  });

  // Availability radio listener
  document.querySelectorAll('input[name="availability"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isAvail = e.target.value === 'Yes';
      document.getElementById('ratingBlock').style.opacity = isAvail ? '1' : '0.35';
      document.getElementById('issuesBlock').style.opacity = isAvail ? '1' : '0.35';
    });
  });

  // Camera Input
  const cameraInput = document.getElementById('cameraInput');
  const btnTriggerCamera = document.getElementById('btnTriggerCamera');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  const photoPreviewContainer = document.getElementById('photoPreviewContainer');
  const photoPreviewImg = document.getElementById('photoPreviewImg');

  if (btnTriggerCamera && cameraInput) {
    btnTriggerCamera.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(event) {
        const compressedBase64 = await compressImage(event.target.result);
        if (photoPreviewImg) photoPreviewImg.src = compressedBase64;
        if (photoPreviewContainer) photoPreviewContainer.style.display = 'block';
        if (btnRemovePhoto) btnRemovePhoto.style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', () => {
      if (cameraInput) cameraInput.value = '';
      if (photoPreviewImg) photoPreviewImg.src = '';
      if (photoPreviewContainer) photoPreviewContainer.style.display = 'none';
      btnRemovePhoto.style.display = 'none';
    });
  }
}

function resetEvaluationsData() {
  state.currentPcEvaluations = {};
  PERIPHERALS.forEach(p => {
    state.currentPcEvaluations[p.id] = {
      availability: 'Yes',
      conditionRating: 5,
      issues: ['None'],
      customIssue: '',
      photo: null,
      isCompleted: false
    };
  });
}

function getRoomStatus(room) {
  return state.roomStatuses[room.id] || room.status;
}

function isRoomLocked(room) {
  return getRoomStatus(room) !== 'Available';
}

function roomStatusClass(status) {
  if (status === 'Being Fixed') return 'status-maintenance';
  if (status === 'Being Updated') return 'status-updating';
  return 'status-available';
}

function splitRoomName(name) {
  const m = String(name).match(/^(\S+)\s*(\(.*\))?$/);
  return { code: m ? m[1] : name, sub: m && m[2] ? m[2] : '' };
}

function buildRoomTile(room, mode) {
  const status = getRoomStatus(room);
  const locked = isRoomLocked(room);
  const { code, sub } = splitRoomName(room.name);
  const tile = document.createElement('div');
  tile.className = `room-tile ${roomStatusClass(status)}${mode === 'student' && locked ? ' room-student-locked' : ''}`;
  let lockLabel = '';
  if (mode === 'custodian') {
    lockLabel = locked
      ? '<span class="room-lock-label is-locked">&#128274; LOCKED</span>'
      : '<span class="room-lock-label">&#128275; UNLOCKED</span>';
  } else if (locked) {
    lockLabel = '<span class="room-lock-label is-locked">&#128274; LOCKED</span>';
  }
  tile.innerHTML = `
    <div class="room-box">
      <span class="room-box-status">${status}</span>
      ${lockLabel}
    </div>
    <div class="room-code">${code}</div>
    ${sub ? `<div class="room-sub">${sub}</div>` : ''}
  `;
  return tile;
}

function fillRoomBoard(board, mode, onClick) {
  board.innerHTML = '';
  [LAB_ROOMS.slice(0, 5), LAB_ROOMS.slice(5)].forEach(rowRooms => {
    const row = document.createElement('div');
    row.className = 'room-row';
    rowRooms.forEach(room => {
      const tile = buildRoomTile(room, mode);
      tile.addEventListener('click', () => onClick(room));
      row.appendChild(tile);
    });
    board.appendChild(row);
  });
}

function renderRooms() {
  const board = document.getElementById('roomGridContainer');
  if (!board) return;
  fillRoomBoard(board, 'student', (room) => {
    if (isRoomLocked(room)) {
      appAlert(`Room ${splitRoomName(room.name).code} is locked (${getRoomStatus(room)}). Please choose another room.`, { type: 'warning', title: 'ROOM LOCKED' });
      return;
    }
    state.selectedRoom = room.id;
    document.getElementById('pcSelectionHeading').innerText = `ROOM ${room.name}: SELECT YOUR PC WORKSPACE`;
    renderSeatsMatrix();
    navigateTo('view-pc-selection');
  });
}

function renderSeatsMatrix() {
  const leftCol = document.getElementById('seatsLeftCol');
  const centerGrid = document.getElementById('seatsCenterGrid');
  const rightCol = document.getElementById('seatsRightCol');
  if (!leftCol || !centerGrid || !rightCol) return;
  leftCol.innerHTML = '';
  centerGrid.innerHTML = '';
  rightCol.innerHTML = '';

  for (let i = 1; i <= 32; i++) {
    const seatBtn = document.createElement('button');
    seatBtn.type = 'button';
    seatBtn.className = 'seat-btn';
    seatBtn.innerText = i < 10 ? `0${i}` : `${i}`;
    const existing = state.submittedRecords.find(
      r => r.room === state.selectedRoom && Number(r.pcNo) === i
    );
    if (existing) {
      if (existing.status === 'unusable') seatBtn.classList.add('status-unusable');
      else if (existing.status === 'semi') seatBtn.classList.add('status-semi');
      else if (existing.status === 'functional') seatBtn.classList.add('status-functional');
    }
    seatBtn.addEventListener('click', () => {
      state.selectedPc = i;
      resetEvaluationsData();
      const hubTitle = document.getElementById('peripheralHubTitle');
      if (hubTitle) {
        hubTitle.innerText = `${state.selectedRoom} • PC #${seatBtn.innerText}: CLICK THE PERIPHERAL'S IMAGE TO EVALUATE`;
      }
      renderPeripheralsHub();
      navigateTo('view-peripheral-selection');
    });

    if (i <= 4) {
      leftCol.appendChild(seatBtn);
    } else if (i <= 28) {
      centerGrid.appendChild(seatBtn);
    } else {
      rightCol.appendChild(seatBtn);
    }
  }
}

function renderPeripheralsHub() {
  const hub = document.getElementById('peripheralsHubGrid');
  if (!hub) return;
  hub.innerHTML = '';
  PERIPHERALS.forEach(item => {
    const evalData = state.currentPcEvaluations[item.id];
    const box = document.createElement('div');
    box.className = `peripheral-box ${evalData?.isCompleted ? 'completed' : ''}`;
    box.innerHTML = `
      <div class="peripheral-svg-wrap">${ICONS[item.iconKey]}</div>
      <h4>${item.name}</h4>
      <span class="status-tag">${evalData?.isCompleted ? '✓ Checked' : 'Pending Check'}</span>
    `;
    box.addEventListener('click', () => openConditionFormForPeripheral(item.id));
    hub.appendChild(box);
  });
}

function openConditionFormForPeripheral(peripheralId) {
  state.activePeripheralId = peripheralId;
  const pConfig = PERIPHERALS.find(p => p.id === peripheralId);
  const data = state.currentPcEvaluations[peripheralId];
  document.getElementById('evalCurrentPcBadge').innerText = `PC #${state.selectedPc < 10 ? '0' : ''}${state.selectedPc}`;
  document.getElementById('evalCurrentPeripheralName').innerText = pConfig.name.toUpperCase();
  document.getElementById('evalIconPreview').innerHTML = ICONS[pConfig.iconKey];
  const radio = document.querySelector(`input[name="availability"][value="${data.availability}"]`);
  if (radio) radio.checked = true;
  setStarRating(data.conditionRating || 5);
  const issuesListContainer = document.getElementById('issuesChecklistContainer');
  issuesListContainer.innerHTML = '';
  (PERIPHERAL_ISSUES[peripheralId] || []).forEach(issue => {
    const lbl = document.createElement('label');
    const checked = data.issues.includes(issue) ? 'checked' : '';
    lbl.innerHTML = `<input type="checkbox" value="${issue}" ${checked}> ${issue}`;
    issuesListContainer.appendChild(lbl);
  });
  issuesListContainer.querySelectorAll('input').forEach(chk => {
    chk.addEventListener('change', (e) => {
      if (e.target.value === 'None' && e.target.checked) {
        issuesListContainer.querySelectorAll('input').forEach(other => {
          if (other.value !== 'None') other.checked = false;
        });
      } else if (e.target.value !== 'None' && e.target.checked) {
        const noneChk = issuesListContainer.querySelector('input[value="None"]');
        if (noneChk) noneChk.checked = false;
      }
    });
  });
  document.getElementById('customIssueInput').value = data.customIssue || '';
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const photoPreviewContainer = document.getElementById('photoPreviewContainer');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  if (photoPreviewContainer && btnRemovePhoto && photoPreviewImg) {
    if (data.photo) {
      photoPreviewImg.src = data.photo;
      photoPreviewContainer.style.display = 'block';
      btnRemovePhoto.style.display = 'inline-block';
    } else {
      photoPreviewImg.src = '';
      photoPreviewContainer.style.display = 'none';
      btnRemovePhoto.style.display = 'none';
    }
  }
  const overviewTitle = document.getElementById('overviewHeaderTitle');
  if (overviewTitle) {
    overviewTitle.innerText = `PC #${state.selectedPc < 10 ? '0' : ''}${state.selectedPc} Evaluation Overview`;
  }
  renderInlineOverviewTable();
  navigateTo('view-condition-form');
}

function setStarRating(rating) {
  state.currentRating = rating;
  const stars = document.querySelectorAll('#starRatingContainer .star');
  stars.forEach(s => {
    const sVal = parseInt(s.dataset.value);
    s.classList.toggle('active', sVal <= rating);
  });
  const ratingDesc = {
    1: '1 / 5 - Dire / Broken',
    2: '2 / 5 - Poor Condition',
    3: '3 / 5 - Fair / Usable',
    4: '4 / 5 - Good Condition',
    5: '5 / 5 - Excellent'
  };
  const lbl = document.getElementById('ratingLabel');
  if (lbl) lbl.innerText = ratingDesc[rating] || `${rating} / 5`;
}

function saveCurrentPeripheralEvaluation() {
  const selectedAvail = document.querySelector('input[name="availability"]:checked')?.value || 'Yes';
  const checkedBoxes = Array.from(document.querySelectorAll('#issuesChecklistContainer input:checked')).map(c => c.value);
  const custom = document.getElementById('customIssueInput').value.trim();
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const capturedPhoto = (photoPreviewImg && photoPreviewImg.src.startsWith('data:image')) 
    ? photoPreviewImg.src 
    : null;
  state.currentPcEvaluations[state.activePeripheralId] = {
    availability: selectedAvail,
    conditionRating: selectedAvail === 'Yes' ? state.currentRating : null,
    issues: checkedBoxes.length > 0 ? checkedBoxes : ['None'],
    customIssue: custom,
    photo: capturedPhoto,
    isCompleted: true
  };
  renderInlineOverviewTable();
  renderPeripheralsHub();
  appAlert(`${PERIPHERALS.find(p => p.id === state.activePeripheralId).name} assessment saved!`, { type: 'success', title: 'ASSESSMENT SAVED' });
}

function resetCurrentPeripheralForm() {
  state.currentPcEvaluations[state.activePeripheralId] = {
    availability: 'Yes',
    conditionRating: 5,
    issues: ['None'],
    customIssue: '',
    photo: null,
    isCompleted: false
  };
  const cameraInput = document.getElementById('cameraInput');
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const photoPreviewContainer = document.getElementById('photoPreviewContainer');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  if (cameraInput) cameraInput.value = '';
  if (photoPreviewImg) photoPreviewImg.src = '';
  if (photoPreviewContainer) photoPreviewContainer.style.display = 'none';
  if (btnRemovePhoto) btnRemovePhoto.style.display = 'none';
  openConditionFormForPeripheral(state.activePeripheralId);
}

function renderInlineOverviewTable() {
  const tbody = document.getElementById('inlineOverviewTableBody');
  tbody.innerHTML = '';
  PERIPHERALS.forEach(p => {
    const item = state.currentPcEvaluations[p.id];
    const tr = document.createElement('tr');
    let issuesStr = item.issues.filter(i => i !== 'None').join(', ');
    if (item.customIssue) issuesStr += (issuesStr ? `, ` : '') + item.customIssue;
    if (!issuesStr) issuesStr = item.isCompleted ? 'None' : '-';
    const isPresent = item.availability === 'Yes';
    const conditionText = isPresent ? (item.isCompleted ? `${item.conditionRating} ★` : '-') : '';
    const issuesText = isPresent ? issuesStr : '';
    const photoHtml = item.photo
      ? `<img src="${item.photo}" class="modal-photo-thumb" style="width:36px; height:28px;" />`
      : `<span style="color:var(--text-muted);">-</span>`;
    tr.innerHTML = `
      <td title="Click to edit" style="cursor:pointer;" class="clickable-row">
        <span class="table-icon-mini">${ICONS[p.iconKey]}</span> ${p.name}
      </td>
      <td>${item.availability || 'Yes'}</td>
      <td>${conditionText}</td>
      <td>${issuesText}</td>
      <td>${photoHtml}</td>
    `;
    tr.querySelector('.clickable-row').addEventListener('click', () => {
      openConditionFormForPeripheral(p.id);
    });
    tbody.appendChild(tr);
  });
}

function populateAndGoToSummary() {
  const tbody = document.getElementById('finalSummaryTableBody');
  tbody.innerHTML = '';
  PERIPHERALS.forEach(p => {
    const item = state.currentPcEvaluations[p.id];
    const isPresent = item.availability === 'Yes';
    let issuesStr = item.issues.filter(i => i !== 'None').join(', ');
    if (item.customIssue) issuesStr += (issuesStr ? `, ` : '') + item.customIssue;
    if (!issuesStr) issuesStr = 'None';
    const photoHtml = item.photo
      ? `<img src="${item.photo}" class="modal-photo-thumb" style="width:40px; height:30px;" />`
      : `<span style="color:var(--text-muted);">-</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="table-icon-mini">${ICONS[p.iconKey]}</span> ${p.name}</td>
      <td>${item.availability}</td>
      <td>${isPresent ? `${item.conditionRating || 5} ★` : '-'}</td>
      <td>${isPresent ? issuesStr : 'Missing / Not provided'}</td>
      <td>${photoHtml}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('summaryMetaDisplay').innerHTML = `
    <div><strong>Student Number:</strong> ${state.studentDetails.studentNo}</div>
    <div><strong>Student Name:</strong> ${state.studentDetails.studentName}</div>
    <div><strong>Section:</strong> ${state.studentDetails.section}</div>
    <div><strong>Assigned Workspace:</strong> Room ${state.selectedRoom} - PC #${state.selectedPc}</div>
    <div><strong>Date:</strong> ${state.studentDetails.evalDate}</div>
    <div><strong>Course Schedule:</strong> ${state.studentDetails.classSchedule}</div>
    <div><strong>Subject Instructor:</strong> ${state.studentDetails.instructorName}</div>
  `;
  document.getElementById('pledgeCheckbox').checked = false;
  document.getElementById('btnSubmitFinalReport').disabled = true;
  navigateTo('view-report-summary');
}

async function submitFinalReport() {
  const submitBtn = document.getElementById('btnSubmitFinalReport');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'SAVING TO CLOUD...';
  }
  let redFlag = false;
  let yellowFlag = false;
  let flaggedIssuesList = [];
  let affectedList = [];
  PERIPHERALS.forEach(p => {
    const item = state.currentPcEvaluations[p.id];
    const hasIssues = item.issues.some(i => i !== 'None') || Boolean(item.customIssue);
    const isMissing = item.availability !== 'Yes';
    if (item.conditionRating <= 2 || (isMissing && ['monitor', 'system_unit'].includes(p.id))) {
      redFlag = true;
      affectedList.push(p.name);
    } else if (item.conditionRating === 3 || hasIssues || isMissing) {
      yellowFlag = true;
      affectedList.push(p.name);
    }
    if (hasIssues) {
      flaggedIssuesList.push(...item.issues.filter(i => i !== 'None'));
      if (item.customIssue) flaggedIssuesList.push(item.customIssue);
    }
  });
  const finalStatus = redFlag ? 'unusable' : (yellowFlag ? 'semi' : 'functional');
  const now = new Date();
  const timeFormatted = `${now.toLocaleDateString()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const newRecord = {
    id: `REC-${Date.now().toString().slice(-4)}`,
    room: state.selectedRoom,
    pcNo: state.selectedPc,
    status: finalStatus,
    verificationStatus: 'Pending',
    issuesSummary: flaggedIssuesList.length > 0 ? flaggedIssuesList.slice(0, 3).join(', ') : 'None',
    affectedDevices: affectedList.length > 0 ? affectedList.join(', ') : 'None',
    timestamp: timeFormatted,
    studentNo: state.studentDetails.studentNo,
    studentName: state.studentDetails.studentName,
    section: state.studentDetails.section,
    evaluations: JSON.parse(JSON.stringify(state.currentPcEvaluations))
  };
  try {
    await db.collection('reports').doc(newRecord.id).set(newRecord);
    state.submittedRecords.unshift(newRecord);
    appAlert(`Report for Room ${state.selectedRoom} - PC #${state.selectedPc} was submitted and saved.`, { type: 'success', title: 'REPORT SUBMITTED' });
    navigateTo('view-splash');
  } catch (error) {
    console.error('Firestore Error:', error);
    appAlert('Firebase Error: ' + error.message, { type: 'error', title: 'FIREBASE ERROR' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'SUBMIT & SAVE';
    }
  }
}

// INSTRUCTOR MODULE: Verification & Approval
let currentInspectedRecord = null;
async function updateDashboardData(sectionFilter = 'ALL') {
  try {
    const snapshot = await db.collection('reports').get();
    if (!snapshot.empty) {
      const cloudRecords = [];
      snapshot.forEach(doc => {
        const item = doc.data();
        item.id = doc.id;
        cloudRecords.push(item);
      });
      state.submittedRecords = cloudRecords;
    }
  } catch (err) {
    console.warn('Could not sync reports from Firestore:', err);
  }
  const filtered = sectionFilter === 'ALL'
    ? state.submittedRecords
    : state.submittedRecords.filter(r => r.section === sectionFilter);
  const tbody = document.getElementById('instructorReportTableBody');
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No logs registered for section ${sectionFilter}.</td></tr>`;
    return;
  }
  filtered.forEach(rec => {
    const tr = document.createElement('tr');
    const vStatus = rec.verificationStatus || 'Pending';
    const vColor = vStatus === 'Approved' ? 'var(--color-green)' : (vStatus === 'Denied' ? 'var(--color-red)' : 'var(--color-yellow)');
    tr.innerHTML = `
      <td><span class="badge-status ${rec.status === 'unusable' ? 'red' : (rec.status === 'semi' ? 'yellow' : 'green')}">${rec.status.toUpperCase()}</span></td>
      <td>${rec.room}</td>
      <td>${rec.pcNo}</td>
      <td>${rec.studentNo}</td>
      <td><button class="btn btn-secondary btn-sm btn-verify-report" data-id="${rec.id}">VIEW</button></td>
      <td style="color:${vColor}; font-weight:bold;">${vStatus}</td>
    `;
    tr.querySelector('.btn-verify-report').addEventListener('click', () => {
      openInstructorVerificationModal(rec);
    });
    tbody.appendChild(tr);
  });
}

function filterInstructorBySection(sec) {
  updateDashboardData(sec);
}

function openInstructorVerificationModal(record) {
  currentInspectedRecord = record;
  const modal = document.getElementById('instructorVerifyModal');
  const title = document.getElementById('verifyModalTitle');
  const body = document.getElementById('verifyModalBody');
  title.innerText = `REPORT SUMMARY SHEET: Room ${record.room} - PC #${record.pcNo}`;
  let evalRows = '';
  if (record.evaluations) {
    Object.keys(record.evaluations).forEach(k => {
      const e = record.evaluations[k];
      const pName = PERIPHERALS.find(p => p.id === k)?.name || k;
      const photoHtml = e.photo
        ? `<img src="${e.photo}" class="modal-photo-thumb" data-photo="${e.photo}" title="Click to enlarge" />`
        : '-';
      evalRows += `
        <tr>
          <td><strong>${pName}</strong></td>
          <td>${e.availability}</td>
          <td>${e.conditionRating ? e.conditionRating + ' ★' : '-'}</td>
          <td>${e.issues.join(', ')} ${e.customIssue ? `(${e.customIssue})` : ''}</td>
          <td>${photoHtml}</td>
        </tr>
      `;
    });
  }
  body.innerHTML = `
    <div style="margin-bottom:1rem; font-size:0.9rem; line-height:1.6;">
      <div><strong>Student Name:</strong> ${record.studentName} (${record.studentNo})</div>
      <div><strong>Section:</strong> ${record.section || 'BSIT-2A'} &bull; <strong>Timestamp:</strong> ${record.timestamp}</div>
      <div><strong>PC Status:</strong> <span class="badge-status ${record.status === 'unusable' ? 'red' : (record.status === 'semi' ? 'yellow' : 'green')}">${record.status.toUpperCase()}</span> &bull; <strong>Verification:</strong> ${record.verificationStatus || 'Pending'}</div>
    </div>
    <table class="retro-table">
      <thead>
        <tr><th>Equipment</th><th>Availability</th><th>Condition</th><th>Issue(s) Raised</th><th>Image Evidence</th></tr>
      </thead>
      <tbody>
        ${evalRows || `<tr><td colspan="5">No peripheral breakdown available.</td></tr>`}
      </tbody>
    </table>
  `;
  modal.querySelectorAll('.modal-photo-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const targetImg = document.getElementById('enlargedPreviewImg');
      if (targetImg) {
        targetImg.src = thumb.dataset.photo;
        document.getElementById('imagePreviewModal').classList.add('active');
      }
    });
  });
  modal.classList.add('active');
}

document.getElementById('btnApproveReport').addEventListener('click', async () => {
  if (!currentInspectedRecord) return;
  await setReportVerification(currentInspectedRecord.id, 'Approved');
});

document.getElementById('btnDenyReport').addEventListener('click', async () => {
  if (!currentInspectedRecord) return;
  await setReportVerification(currentInspectedRecord.id, 'Denied');
});

async function setReportVerification(recId, newStatus) {
  try {
    await db.collection('reports').doc(recId).update({ verificationStatus: newStatus });
    const target = state.submittedRecords.find(r => r.id === recId);
    if (target) target.verificationStatus = newStatus;
    appAlert(`Report ${recId} has been marked as ${newStatus.toUpperCase()}.`, newStatus === 'Approved'
      ? { type: 'success', title: 'REPORT APPROVED' }
      : { type: 'warning', title: 'REPORT DENIED' });
    document.getElementById('instructorVerifyModal').classList.remove('active');
    updateDashboardData();
  } catch (err) {
    appAlert('Error updating status: ' + err.message, { type: 'error', title: 'UPDATE FAILED' });
  }
}

// PROPERTY CUSTODIAN MODULE
async function updateCustodianDashboard(roomFilter = 'ALL') {
  const approvedOnly = state.submittedRecords.filter(r => r.verificationStatus === 'Approved');
  const filtered = roomFilter === 'ALL'
    ? approvedOnly
    : approvedOnly.filter(r => r.room === roomFilter);
  const unusableCount = filtered.filter(r => r.status === 'unusable').length;
  const semiCount = filtered.filter(r => r.status === 'semi').length;
  const functionalCount = filtered.filter(r => r.status === 'functional').length;
  document.getElementById('custCountUnusable').innerText = unusableCount;
  document.getElementById('custCountSemi').innerText = semiCount;
  document.getElementById('custCountFunctional').innerText = functionalCount;
  document.getElementById('custCountTotal').innerText = filtered.length;
  const tbody = document.getElementById('custodianReportTableBody');
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No approved reports logged for room ${roomFilter}.</td></tr>`;
    return;
  }
  filtered.forEach(rec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-status ${rec.status === 'unusable' ? 'red' : (rec.status === 'semi' ? 'yellow' : 'green')}">${rec.status.toUpperCase()}</span></td>
      <td>${rec.room}</td>
      <td>${rec.pcNo}</td>
      <td>${rec.issuesSummary}</td>
      <td>${rec.affectedDevices}</td>
      <td>${rec.timestamp}</td>
      <td>${rec.studentNo}</td>
      <td><button class="btn btn-secondary btn-sm btn-cust-view" data-id="${rec.id}">VIEW</button></td>
    `;
    tr.querySelector('.btn-cust-view').addEventListener('click', () => {
      openReportDetailsModal(rec);
    });
    tbody.appendChild(tr);
  });
}

function filterCustodianByRoom(room) {
  updateCustodianDashboard(room);
}

let activeEditingRoomId = null;
let pendingRoomStatus = 'Available';

function renderCustodianRoomManagement() {
  const board = document.getElementById('custRoomManagementGrid');
  if (!board) return;
  let avail = 0, fixed = 0, update = 0;
  LAB_ROOMS.forEach(room => {
    const status = getRoomStatus(room);
    if (status === 'Available') avail++;
    else if (status === 'Being Fixed') fixed++;
    else if (status === 'Being Updated') update++;
  });
  fillRoomBoard(board, 'custodian', openRoomEditModal);
  document.getElementById('countRoomsAvail').innerText = avail;
  document.getElementById('countRoomsFixed').innerText = fixed;
  document.getElementById('countRoomsUpdating').innerText = update;
}

function openRoomEditModal(room) {
  activeEditingRoomId = room.id;
  pendingRoomStatus = getRoomStatus(room);
  document.getElementById('editRoomNoText').innerText = splitRoomName(room.name).code;
  refreshRoomEditModal();
  document.getElementById('editRoomStatusModal').classList.add('active');
}

function refreshRoomEditModal() {
  const statusText = document.getElementById('currentRoomStatusText');
  statusText.innerText = pendingRoomStatus;
  statusText.dataset.status = pendingRoomStatus;
  document.getElementById('roomLockLabelText').innerHTML =
    pendingRoomStatus === 'Available' ? '&#128275; UNLOCKED' : '&#128274; LOCKED';
  document.querySelectorAll('.btn-status-choice').forEach(btn => {
    btn.disabled = btn.dataset.status === pendingRoomStatus;
  });
}

document.querySelectorAll('.btn-status-choice').forEach(btn => {
  btn.addEventListener('click', () => {
    pendingRoomStatus = btn.dataset.status;
    refreshRoomEditModal();
  });
});

document.getElementById('btnSaveRoomStatus').addEventListener('click', async () => {
  if (!activeEditingRoomId) return;
  const chosen = pendingRoomStatus;
  const locked = chosen !== 'Available';
  try {
    await db.collection('room_statuses').doc(activeEditingRoomId).set(
      { status: chosen, locked },
      { merge: true }
    );
    state.roomStatuses[activeEditingRoomId] = chosen;
    renderCustodianRoomManagement();
    renderRooms();
    document.getElementById('editRoomStatusModal').classList.remove('active');
    appAlert(`Room ${activeEditingRoomId} is now ${chosen}${locked ? ' and LOCKED' : ' and UNLOCKED'}.`, { type: 'success', title: 'ROOM STATUS UPDATED' });
  } catch (err) {
    appAlert('Failed to update status: ' + err.message, { type: 'error', title: 'UPDATE FAILED' });
  }
});

let currentViewedRecord = null;
function openReportDetailsModal(record) {
  currentViewedRecord = record;
  const modal = document.getElementById('reportDetailModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  title.innerText = `Full Inspection Log: ${record.room} - PC #${record.pcNo}`;
  let evalRows = '';
  if (record.evaluations) {
    Object.keys(record.evaluations).forEach(k => {
      const e = record.evaluations[k];
      const pName = PERIPHERALS.find(p => p.id === k)?.name || k;
      const photoHtml = e.photo
        ? `<img src="${e.photo}" class="modal-photo-thumb" data-photo="${e.photo}" title="Click to enlarge"/>`
        : '<span style="color:var(--text-muted);">-</span>';
      evalRows += `
        <tr>
          <td><strong>${pName}</strong></td>
          <td>${e.availability}</td>
          <td>${e.conditionRating ? e.conditionRating + ' ★' : '-'}</td>
          <td>${e.issues.join(', ')} ${e.customIssue ? `(${e.customIssue})` : ''}</td>
          <td>${photoHtml}</td>
        </tr>
      `;
    });
  }
  body.innerHTML = `
    <div style="margin-bottom:1rem; font-size:0.9rem; line-height:1.6;">
      <div><strong>Evaluator:</strong> ${record.studentName} (${record.studentNo})</div>
      <div><strong>Timestamp:</strong> ${record.timestamp}</div>
      <div><strong>Computed Status:</strong> <span class="badge-status ${record.status === 'unusable' ? 'red' : (record.status === 'semi' ? 'yellow' : 'green')}">${record.status.toUpperCase()}</span></div>
    </div>
    <table class="retro-table">
      <thead>
        <tr><th>Peripheral</th><th>Availability</th><th>Condition</th><th>Issues</th><th>Photo</th></tr>
      </thead>
      <tbody>
        ${evalRows || `<tr><td colspan="5">Detailed component snapshot unavailable.</td></tr>`}
      </tbody>
    </table>
  `;
  modal.querySelectorAll('.modal-photo-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const targetImg = document.getElementById('enlargedPreviewImg');
      if (targetImg) {
        targetImg.src = thumb.dataset.photo;
        document.getElementById('imagePreviewModal').classList.add('active');
      }
    });
  });
  modal.classList.add('active');
}

async function deleteViewedReport(record) {
  if (!record) {
    appAlert('Please open a report first.', { type: 'info', title: 'NO REPORT OPEN' });
    return;
  }
  const ok = await appConfirm(
    `Room ${record.room} - PC #${record.pcNo}\nStudent No.: ${record.studentNo || '-'}\n\nThis cannot be undone.`,
    { title: 'DELETE THIS REPORT?', confirmText: 'DELETE', cancelText: 'CANCEL', danger: true }
  );
  if (!ok) return;
  try {
    await db.collection('reports').doc(record.id).delete();
    state.submittedRecords = state.submittedRecords.filter(r => r.id !== record.id);
    currentViewedRecord = null;
    document.getElementById('reportDetailModal').classList.remove('active');
    const activeRoom = document.querySelector('#custodianRoomFilterList li.active')?.dataset.room || 'ALL';
    updateCustodianDashboard(activeRoom);
    appAlert('The report was deleted.', { type: 'success', title: 'REPORT DELETED' });
  } catch (err) {
    appAlert('Failed to delete report: ' + err.message, { type: 'error', title: 'DELETE FAILED' });
  }
}

// PDF Generation
const PDF_MARGIN = 40;
function pdfLibReady() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    appAlert('PDF library did not load. Please check your internet connection and reload the page.', { type: 'error', title: 'PDF NOT READY' });
    return false;
  }
  return true;
}

function pdfStatusColor(status) {
  return status === 'unusable' ? [200, 30, 30] : (status === 'semi' ? [190, 130, 0] : [20, 130, 50]);
}

function drawReportOnPdf(doc, record) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = PDF_MARGIN;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('EquiCheck', margin, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Laboratory Equipment Inspection Report', margin, 68);
  doc.setFontSize(9);
  doc.text('TSU-CCS San Isidro Campus', margin, 82);
  doc.setDrawColor(150);
  doc.line(margin, 92, pageW - margin, 92);

  const details = [
    ['Student Name', record.studentName || '-'],
    ['Student No.', record.studentNo || '-'],
    ['Section', record.section || '-'],
    ['Room / PC', `${record.room} - PC #${record.pcNo}`],
    ['Date & Time', record.timestamp || '-'],
    ['Verification', record.verificationStatus || 'Pending']
  ];
  let y = 112;
  doc.setFontSize(10);
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 95, y);
    y += 16;
  });
  doc.setFont('helvetica', 'bold');
  doc.text('PC Status:', margin, y);
  doc.setTextColor(...pdfStatusColor(record.status));
  doc.text((record.status || '').toUpperCase(), margin + 95, y);
  doc.setTextColor(0, 0, 0);
  y += 14;
  if (record.issuesSummary && record.issuesSummary !== 'None') {
    doc.setFont('helvetica', 'bold');
    doc.text('Flagged Issues:', margin, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(String(record.issuesSummary), pageW - margin * 2 - 95), margin + 95, y + 4);
    y += 20;
  }

  const body = [];
  const evidence = [];
  PERIPHERALS.forEach(p => {
    const e = record.evaluations && record.evaluations[p.id];
    if (!e) return;
    const present = e.availability === 'Yes';
    const issueList = (e.issues || []).filter(i => i !== 'None');
    if (e.customIssue) issueList.push(e.customIssue);
    const issuesStr = present ? (issueList.length ? issueList.join(', ') : 'None') : 'Missing / Not provided';
    body.push([
      p.name,
      e.availability,
      present && e.conditionRating ? `${e.conditionRating} / 5` : '-',
      issuesStr
    ]);
    if (e.photo) evidence.push({ name: p.name, photo: e.photo });
  });
  if (body.length === 0) {
    body.push([{ content: 'No peripheral breakdown available for this report.', colSpan: 4, styles: { halign: 'center' } }]);
  }
  doc.autoTable({
    startY: y + 8,
    head: [['Equipment', 'Availability', 'Condition', 'Issue(s) Raised']],
    body,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [30, 60, 90], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 70 },
      2: { cellWidth: 65 },
      3: { cellWidth: 'auto' }
    }
  });

  if (evidence.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    const maxH = 330;
    let yy = doc.lastAutoTable.finalY + 26;
    const heading = (yPos) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Image Evidence', margin, yPos);
      doc.setDrawColor(150);
      doc.line(margin, yPos + 4, pageW - margin, yPos + 4);
    };
    if (yy + 40 > pageH - 50) { doc.addPage(); yy = 50; }
    heading(yy);
    yy += 22;
    evidence.forEach(item => {
      try {
        const props = doc.getImageProperties(item.photo);
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        if (yy + 16 + h > pageH - 50) {
          doc.addPage();
          yy = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(item.name, margin, yy);
        yy += 8;
        const fmt = item.photo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.setDrawColor(150);
        doc.rect(margin, yy, w, h);
        doc.addImage(item.photo, fmt, margin, yy, w, h);
        yy += h + 22;
      } catch (err) {
        console.warn('Could not add image to PDF:', err);
      }
    });
  }
}

function finishAndSavePdf(doc, filename) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Generated on ${new Date().toLocaleString()}`, PDF_MARGIN, pageH - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageW - PDF_MARGIN, pageH - 20, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  doc.save(filename);
}

const pdfSafe = (v) => String(v || '').replace(/[^a-z0-9_-]/gi, '');

function downloadReportPdf(record) {
  if (!record) {
    appAlert('Please open a report first.', { type: 'info', title: 'NO REPORT OPEN' });
    return;
  }
  if (!pdfLibReady()) return;
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  drawReportOnPdf(doc, record);
  finishAndSavePdf(doc, `Report_${pdfSafe(record.room)}_PC${pdfSafe(record.pcNo)}_${pdfSafe(record.studentNo)}.pdf`);
}

function exportReportsToPdf() {
  if (!pdfLibReady()) return;
  const roomFilter = document.querySelector('#custodianRoomFilterList li.active')?.dataset.room || 'ALL';
  const reports = state.submittedRecords.filter(r =>
    r.verificationStatus === 'Approved' && (roomFilter === 'ALL' || r.room === roomFilter)
  );
  if (reports.length === 0) {
    appAlert(roomFilter === 'ALL' ? 'There are no approved reports to export.' : `There are no approved reports for room ${roomFilter}.`, { type: 'info', title: 'NOTHING TO EXPORT' });
    return;
  }
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  reports.forEach((record, i) => {
    if (i > 0) doc.addPage();
    drawReportOnPdf(doc, record);
  });
  finishAndSavePdf(doc, `EquiCheck_Reports_${roomFilter === 'ALL' ? 'AllRooms' : pdfSafe(roomFilter)}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportReportsToJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.submittedRecords, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `EquiCheck_Report_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}