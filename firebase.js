import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Types & Handler
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is unreachable.');
    }
  }
}
testFirebaseConnection();

// Authentication helpers
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
}

// --- FIRESTORE DATA ADAPTERS ---

/**
 * Save or update a cash memo in Firestore
 */
export async function saveMemoToCloud(memo) {
  if (!auth.currentUser) throw new Error('User must be signed in to save memo');
  const path = `memos/${memo.id || memo.memoNo}`;
  try {
    const docRef = doc(db, 'memos', String(memo.id || memo.memoNo));
    const payload = {
      id: String(memo.id || memo.memoNo),
      memoNo: String(memo.memoNo || ''),
      date: String(memo.date || ''),
      customerName: String(memo.customerName || ''),
      customerMobile: String(memo.customerMobile || ''),
      customerAddress: String(memo.customerAddress || ''),
      items: Array.isArray(memo.items) ? memo.items.map(it => ({
        id: String(it.id || ''),
        name: String(it.name || ''),
        qty: String(it.qty || ''),
        price: String(it.price || '')
      })) : [],
      subtotal: Number(memo.subtotal) || 0,
      discount: Number(memo.discount) || 0,
      grandTotal: Number(memo.grandTotal) || 0,
      paid: Number(memo.paid) || 0,
      due: Number(memo.due) || 0,
      paymentMethod: String(memo.paymentMethod || 'cash'),
      authorId: auth.currentUser.uid,
      authorEmail: auth.currentUser.email || '',
      createdAt: String(memo.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a memo from Firestore and archive in trash
 */
export async function deleteMemoFromCloud(memoId, memoData = null) {
  if (!auth.currentUser) throw new Error('User must be signed in to delete memo');
  const path = `memos/${memoId}`;
  try {
    if (memoData) {
      const trashRef = doc(db, 'trash', String(memoId));
      await setDoc(trashRef, {
        id: String(memoId),
        memoId: String(memoId),
        memoData: memoData,
        authorId: auth.currentUser.uid,
        deletedAt: new Date().toISOString()
      });
    }
    await deleteDoc(doc(db, 'memos', String(memoId)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to Memos collection in real-time
 */
export function subscribeMemos(onMemosUpdated, onError) {
  if (!auth.currentUser) return () => {};
  const q = query(collection(db, 'memos'), where('authorId', '==', auth.currentUser.uid));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    onMemosUpdated(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'memos');
    if (onError) onError(err);
  });
}

/**
 * Save product to Firestore
 */
export async function saveProductToCloud(product) {
  if (!auth.currentUser) throw new Error('User must be signed in to save product');
  const prodId = String(product.id || 'prod_' + Date.now());
  const path = `products/${prodId}`;
  try {
    const payload = {
      id: prodId,
      name: String(product.name || '').slice(0, 150),
      generic: String(product.generic || '').slice(0, 150),
      strength: String(product.strength || '').slice(0, 60),
      category: String(product.category || '').slice(0, 60),
      unit: String(product.unit || 'পাতা').slice(0, 30),
      unitPrice: Number(product.unitPrice) || 0,
      buyPrice: Number(product.buyPrice) || 0,
      stock: Number(product.stock) || 0,
      minStock: Number(product.minStock) || 0,
      rack: String(product.rack || '').slice(0, 60),
      company: String(product.company || '').slice(0, 120),
      note: String(product.note || '').slice(0, 250),
      authorId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'products', prodId), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete product from Firestore
 */
export async function deleteProductFromCloud(productId) {
  if (!auth.currentUser) throw new Error('User must be signed in to delete product');
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', String(productId)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to Products collection in real-time
 */
export function subscribeProducts(onProductsUpdated, onError) {
  if (!auth.currentUser) return () => {};
  const q = query(collection(db, 'products'), where('authorId', '==', auth.currentUser.uid));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    onProductsUpdated(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'products');
    if (onError) onError(err);
  });
}

/**
 * Save pharmacy profile to Firestore
 */
export async function saveProfileToCloud(profile) {
  if (!auth.currentUser) return;
  const path = `profiles/${auth.currentUser.uid}`;
  try {
    const payload = {
      pharmacyName: String(profile.pharmacyName || 'Jononi Enterprise And Healthcare').slice(0, 150),
      tagline: String(profile.tagline || '').slice(0, 200),
      address: String(profile.address || '').slice(0, 250),
      mobile: String(profile.mobile || '').slice(0, 50),
      email: String(profile.email || '').slice(0, 100),
      dlNo: String(profile.dlNo || '').slice(0, 80),
      footerWish: String(profile.footerWish || '').slice(0, 200),
      customLogo: profile.customLogo ? String(profile.customLogo).slice(0, 500000) : '',
      authorId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'profiles', auth.currentUser.uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Load pharmacy profile from Firestore
 */
export async function loadProfileFromCloud() {
  if (!auth.currentUser) return null;
  const path = `profiles/${auth.currentUser.uid}`;
  try {
    const snap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Save daily memo counter to Firestore
 */
export async function saveCounterToCloud(dateCode, counter) {
  if (!auth.currentUser) return;
  const path = `counters/${dateCode}`;
  try {
    await setDoc(doc(db, 'counters', String(dateCode)), {
      dateCode: String(dateCode),
      counter: Number(counter) || 0,
      authorId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Load daily counters from Firestore
 */
export async function loadCountersFromCloud() {
  if (!auth.currentUser) return {};
  const path = 'counters';
  try {
    const q = query(collection(db, 'counters'), where('authorId', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    const counters = {};
    snap.forEach(d => {
      const data = d.data();
      if (data.dateCode) {
        counters[data.dateCode] = Number(data.counter) || 0;
      }
    });
    return counters;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Subscribe to trash memos
 */
export function subscribeTrash(onTrashUpdated, onError) {
  if (!auth.currentUser) return () => {};
  const q = query(collection(db, 'trash'), where('authorId', '==', auth.currentUser.uid));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
    onTrashUpdated(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'trash');
    if (onError) onError(err);
  });
}

/**
 * Permanently purge trash item or restore
 */
export async function purgeTrashFromCloud(trashId) {
  if (!auth.currentUser) return;
  const path = `trash/${trashId}`;
  try {
    await deleteDoc(doc(db, 'trash', String(trashId)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Clear all user cloud data
 */
export async function clearAllCloudData() {
  if (!auth.currentUser) return;
  try {
    // Delete memos
    const memosSnap = await getDocs(query(collection(db, 'memos'), where('authorId', '==', auth.currentUser.uid)));
    const memoPromises = [];
    memosSnap.forEach(d => memoPromises.push(deleteDoc(d.ref)));
    await Promise.all(memoPromises);

    // Delete products
    const prodSnap = await getDocs(query(collection(db, 'products'), where('authorId', '==', auth.currentUser.uid)));
    const prodPromises = [];
    prodSnap.forEach(d => prodPromises.push(deleteDoc(d.ref)));
    await Promise.all(prodPromises);

    // Delete counters
    const counterSnap = await getDocs(query(collection(db, 'counters'), where('authorId', '==', auth.currentUser.uid)));
    const counterPromises = [];
    counterSnap.forEach(d => counterPromises.push(deleteDoc(d.ref)));
    await Promise.all(counterPromises);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'bulk-clear');
  }
}
