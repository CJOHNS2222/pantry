import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi } from 'vitest';

// Firebase mocks for testing
const mockDoc = (id: string) => ({
  id,
  parent: {
    id: 'test-collection'
  }
});

const mockQuery = {
  type: 'query',
  parent: {
    id: 'test-collection'
  }
};

const mockDocumentSnapshot = {
  exists: vi.fn(() => true),
  data: vi.fn(() => ({
    searches: {
      weekly: 5,
      used: 0,
      resetDate: { toDate: vi.fn(() => new Date()) }
    },
    recipes: {
      max: 10,
      used: 0
    },
    mealPlanning: {
      weeklyRecipes: 5,
      weeklyUsed: 0,
      twoWeekPlanning: false,
      resetDate: { toDate: vi.fn(() => new Date()) }
    },
    gemini: {
      weekly: 10,
      used: 0,
      resetDate: { toDate: vi.fn(() => new Date()) }
    }
  })),
  id: 'test-doc-id'
};

const mockQuerySnapshot = {
  size: 0,
  docs: [],
  forEach: vi.fn((callback) => {
    // Default empty implementation
  }),
  empty: true
};

// Create a more realistic Timestamp mock
const mockTimestamp = {
  toDate: vi.fn(() => new Date()),
  toMillis: vi.fn(() => Date.now()),
  seconds: Math.floor(Date.now() / 1000),
  nanoseconds: 0
};

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ path })),
  doc: vi.fn((collectionRef, id) => ({
    id,
    parent: collectionRef,
    path: `${collectionRef.path}/${id}`
  })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: vi.fn(() => true),
    data: vi.fn(() => ({
      searches: {
        weekly: 5,
        used: 0,
        resetDate: mockTimestamp
      },
      recipes: {
        max: 10,
        used: 0
      },
      mealPlanning: {
        weeklyRecipes: 5,
        weeklyUsed: 0,
        twoWeekPlanning: false,
        resetDate: mockTimestamp
      },
      gemini: {
        weekly: 10,
        used: 0,
        resetDate: mockTimestamp
      },
      subscription: {
        tier: 'free'
      }
    })),
    id: 'test-doc-id'
  })),
  getDocs: vi.fn(() => Promise.resolve({
    size: 0,
    docs: [],
    forEach: vi.fn((callback) => {
      // Default empty implementation
    }),
    empty: true
  })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'test-doc-id' })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  })),
  onSnapshot: vi.fn(() => vi.fn()),
  getFirestore: vi.fn(() => ({})),
  Timestamp: {
    now: vi.fn(() => mockTimestamp),
    fromDate: vi.fn((date) => ({ ...mockTimestamp, toDate: vi.fn(() => date) })),
    fromMillis: vi.fn((millis) => ({ ...mockTimestamp, toMillis: vi.fn(() => millis) }))
  },
  increment: vi.fn((value) => ({ type: 'increment', value }))
}));

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(() => Promise.resolve({ ref: {} })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg')),
  getStorage: vi.fn(() => ({}))
}));

// Mock Firebase Performance
vi.mock('firebase/performance', () => ({
  getPerformance: vi.fn(() => ({})),
  trace: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    putMetric: vi.fn(),
    putAttribute: vi.fn()
  }))
}));

// Mock Firebase Analytics
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
  setUserId: vi.fn()
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  indexedDBLocalPersistence: {}
}));

// Mock Firebase Config
vi.mock('../firebaseConfig', () => ({
  db: {},
  storage: {},
  auth: {},
  analytics: {},
  performance: {}
}));

// Mock Database Monitoring Service - removed global mock to avoid conflicts

// Mock fetch for external API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: () => Promise.resolve({}),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: () => ({}) as Response,
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic' as ResponseType,
    url: ''
  })
);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Make localStorageMock globally available for tests
(global as any).localStorageMock = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// for Vitest: extend expect with testing-library matchers
expect.extend(matchers);
