/**
 * Jononi Pharmacy - Digital Cash Memo Maker
 * Google Firebase Cloud Storage Integrated
 */

import { onAuthStateChanged } from 'firebase/auth';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  saveMemoToCloud, 
  deleteMemoFromCloud, 
  subscribeMemos, 
  saveProductToCloud, 
  deleteProductFromCloud, 
  subscribeProducts, 
  saveProfileToCloud, 
  loadProfileFromCloud, 
  saveCounterToCloud, 
  loadCountersFromCloud, 
  subscribeTrash, 
  purgeTrashFromCloud,
  clearAllCloudData 
} from './firebase.js';

// In-Memory Cloud Data Stores (No business data in localStorage)
let cloudMemos = [];
let cloudProducts = [];
let cloudCounters = {};
let cloudTrash = [];
let unsubscribeMemosFn = null;
let unsubscribeProductsFn = null;
let unsubscribeTrashFn = null;
let currentUser = null;

// --- CONFIG & CONSTANTS ---
const STORAGE_KEYS = {
  LANG: 'jp_lang',
  THEME: 'jp_theme',
  SIDEBAR_COLLAPSED: 'jp_sidebar_collapsed'
};

// Safe global stubs to prevent ReferenceError from any stale cached workers/scripts
window.updateDueManagerTab = function() {
  if (typeof updateHistoryTab === 'function') updateHistoryTab();
  if (typeof updateReportTab === 'function') updateReportTab();
};
window.updateCustomerReportTab = function() {
  if (typeof updateReportTab === 'function') updateReportTab();
};



const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const TRANSLATIONS = {
  bn: {
    appTitle: 'Jononi Pharmacy',
    memoTitle: 'মেমো',
    memoNoLabel: 'মেমো নং',
    dateLabel: 'তারিখ',
    customerLabel: 'গ্রাহকের নাম',
    mobileLabel: 'মোবাইল',
    slLabel: 'ক্র.',
    productLabel: 'প্রোডাক্টের নাম',
    qtyLabel: 'পরিমাণ',
    priceLabel: 'দাম',
    totalLabel: 'মোট',
    subtotalLabel: 'প্রোডাক্টের মূল বিল',
    discountLabel: 'ছাড়',
    grandTotalLabel: 'সর্বমোট',
    paidLabel: 'এডভ্যান্স পেমেন্ট',
    dueLabel: 'বাকি',
    signatureLabel: 'কর্তৃপক্ষের স্বাক্ষর',
    footerText: 'ধন্যবাদ। আল্লাহ আপনাকে দ্রুত সুস্থ করুন।',
    addItemBtn: 'নতুন প্রোডাক্ট যোগ করুন',
    resetBtn: 'রিসেট',
    saveBtn: 'সেভ করুন',
    shareBtn: 'শেয়ার করুন',
    downloadPngBtn: 'ডাউনলোড (PNG)',
    downloadPdfBtn: 'ডাউনলোড (PDF)',
    generalInfoTitle: 'সাধারণ তথ্য',
    productsTitle: 'প্রোডাক্ট তালিকা',
    paymentTitle: 'মূল্য ও পরিশোধ',
    emptyProductWarning: 'কমপক্ষে একটি প্রোডাক্ট নাম বা তথ্য দিন।',
    savedSuccess: 'মেমো সফলভাবে সংরক্ষণ করা হয়েছে!',
    pngSuccess: 'PNG ছবি সফলভাবে তৈরি ও ডাউনলোড হয়েছে!',
    pdfSuccess: 'PDF ফাইল সফলভাবে তৈরি ও ডাউনলোড হয়েছে!',
    shareFallback: 'সরাসরি শেয়ার আপনার ব্রাউজারে সমর্থিত নয়, ছবি ডাউনলোড করা হয়েছে।',
    deleteConfirmTitle: 'মেমো মুছে ফেলবেন?',
    deleteConfirmMsg: 'এই মেমোটি ইতিহাস থেকে মুছে ফেলা হবে। আপনি কি নিশ্চিত?',
    restoreConfirmTitle: 'ব্যাকআপ রিস্টোর করবেন?',
    restoreConfirmMsg: 'এটি বর্তমান ডিভাইসের মেমো ও কাউন্টার প্রতিস্থাপন করবে। এগিয়ে যাবেন?',
    restoreSuccess: 'ব্যাকআপ সফলভাবে রিস্টোর করা হয়েছে!',
    previewShow: 'প্রিভিউ দেখুন',
    previewHide: 'লুকান',
    teaserAction: 'প্রিভিউ খুলতে ক্লিক করুন ▾'
  },
  en: {
    appTitle: 'Jononi Pharmacy',
    memoTitle: 'Cash Memo',
    memoNoLabel: 'Memo No',
    dateLabel: 'Date',
    customerLabel: 'Customer Name',
    mobileLabel: 'Mobile',
    slLabel: 'SL',
    productLabel: 'Product',
    qtyLabel: 'Qty',
    priceLabel: 'Price',
    totalLabel: 'Total',
    subtotalLabel: 'Subtotal',
    discountLabel: 'Discount',
    grandTotalLabel: 'Grand Total',
    paidLabel: 'Paid',
    dueLabel: 'Due',
    signatureLabel: 'Authorized Signature',
    footerText: 'Thank you. Wishing you a speedy recovery.',
    addItemBtn: 'Add Item',
    resetBtn: 'Reset',
    saveBtn: 'Save',
    shareBtn: 'Share',
    downloadPngBtn: 'Download (PNG)',
    downloadPdfBtn: 'Download (PDF)',
    generalInfoTitle: 'General Info',
    productsTitle: 'Product Items',
    paymentTitle: 'Payment & Calculation',
    emptyProductWarning: 'Please enter at least one product.',
    savedSuccess: 'Memo saved successfully!',
    pngSuccess: 'PNG downloaded successfully!',
    pdfSuccess: 'PDF downloaded successfully!',
    shareFallback: 'Direct share not supported on this browser; image downloaded instead.',
    deleteConfirmTitle: 'Delete Memo?',
    deleteConfirmMsg: 'This memo will be removed from history. Are you sure?',
    restoreConfirmTitle: 'Restore Backup?',
    restoreConfirmMsg: 'This will replace existing memos and counters. Continue?',
    restoreSuccess: 'Backup restored successfully!',
    previewShow: 'View Preview',
    previewHide: 'Hide Preview',
    teaserAction: 'Click to expand preview ▾'
  }
};

// Safe Storage Helper
const Storage = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  },
  getJSON(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

// Formatting utilities
function toBanglaDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

function formatMoney(amount, lang = 'bn') {
  const num = Number(amount) || 0;
  const fixed = num.toFixed(2);
  return lang === 'bn' ? `৳${toBanglaDigits(fixed)}` : `৳${fixed}`;
}

function formatDateDisplay(dateStr, lang = 'bn') {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const formatted = `${d}/${m}/${y}`;
  return lang === 'bn' ? toBanglaDigits(formatted) : formatted;
}

function getDateCode(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const yy = y.slice(-2);
  return `${d}${m}${yy}`;
}

// Convert any Bangla digits to English and extract digits only
function extractMobileDigits(mobileStr) {
  if (!mobileStr) return '';
  const normalized = String(mobileStr).replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d));
  return normalized.replace(/\D/g, '');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Today helper
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- APP STATE ---
class AppState {
  constructor() {
    this.lang = Storage.get(STORAGE_KEYS.LANG, 'bn');
    this.theme = Storage.get(STORAGE_KEYS.THEME, 'light');
    this.customLogo = Storage.get(STORAGE_KEYS.CUSTOM_LOGO, null);
    this.currentDate = getTodayDateString();
    this.memoNo = '';
    this.customerName = '';
    this.customerMobile = '';
    this.customerAddress = '';
    this.items = [];
    this.discount = 0;
    this.paid = 0;
    this.paymentMethod = 'cash';
    this.deferredPrompt = null;
    this.previewCollapsed = Storage.get('jp_preview_collapsed', 'true') === 'true';

    this.initDefaultItems();
  }

  initDefaultItems() {
    this.items = [
      { id: '1', name: '', qty: '', price: '' },
      { id: '2', name: '', qty: '', price: '' },
      { id: '3', name: '', qty: '', price: '' }
    ];
  }

  getCounter(dateCode) {
    return Number(cloudCounters[dateCode]) || 0;
  }

  setCounter(dateCode, num) {
    cloudCounters[dateCode] = Number(num) || 0;
    if (auth.currentUser) {
      saveCounterToCloud(dateCode, num).catch((err) => {
        console.warn('Counter save warning:', err);
      });
    }
  }


  getSuggestedMemoNo(dateStr) {
    const code = getDateCode(dateStr);
    const counter = this.getCounter(code);
    const nextSerial = counter + 1;
    const serialStr = nextSerial < 100 ? String(nextSerial).padStart(2, '0') : String(nextSerial);
    return `${code}-${serialStr}`;
  }

  commitMemoNumber(dateStr, currentMemoNo) {
    const code = getDateCode(dateStr);
    let serial = 1;
    const match = currentMemoNo.match(/-(\d+)$/);
    if (match) {
      serial = parseInt(match[1], 10) || 1;
    }
    const stored = this.getCounter(code);
    const updated = Math.max(stored, serial);
    this.setCounter(code, updated);
  }

  calculateTotals() {
    let subtotal = 0;
    this.items.forEach((item) => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.price) || 0;
      if (item.name.trim() !== '' || (q > 0 && p > 0)) {
        subtotal += q * p;
      }
    });

    const discountVal = Math.max(0, parseFloat(this.discount) || 0);
    const grandTotal = Math.max(0, subtotal - discountVal);
    const paidVal = Math.max(0, parseFloat(this.paid) || 0);
    const due = paidVal > 0 ? Math.max(0, grandTotal - paidVal) : 0;

    return {
      subtotal,
      discount: discountVal,
      grandTotal,
      paid: paidVal,
      due
    };
  }
}

const state = new AppState();

// --- DOM ELEMENTS ---
const el = {
  // Shell & Collapsible Sidebar
  appShell: document.getElementById('app-shell'),
  appSidebar: document.getElementById('app-sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  btnSidebarToggle: document.getElementById('btn-sidebar-toggle'),
  btnSidebarCollapse: document.getElementById('btn-sidebar-collapse'),
  sidebarNavItems: document.querySelectorAll('.sidebar-nav-item'),
  sidebarLogoContainer: document.getElementById('sidebar-logo-container'),
  sidebarHistoryCount: document.getElementById('sidebar-history-count'),

  // Brand Header Link (Acts as Home Page)
  headerBrandLink: document.getElementById('header-brand-link'),

  // Theme
  themeBtn: document.getElementById('theme-toggle-btn'),
  btnAndroidToggle: document.getElementById('btn-android-toggle'),
  themeSun: document.getElementById('theme-sun-icon'),
  themeMoon: document.getElementById('theme-moon-icon'),

  // Lang toggles
  langBnBtn: document.getElementById('lang-bn-btn'),
  langEnBtn: document.getElementById('lang-en-btn'),

  // Tabs & Panes
  tabPanes: document.querySelectorAll('.tab-pane'),

  // Form Fields
  inputMemoNo: document.getElementById('input-memo-no'),
  inputDate: document.getElementById('input-date'),
  inputCustomerName: document.getElementById('input-customer-name'),
  inputCustomerMobile: document.getElementById('input-customer-mobile'),
  inputCustomerAddress: document.getElementById('input-customer-address'),
  mobileDigitsCounter: document.getElementById('mobile-digits-counter'),
  mobileErrorMsg: document.getElementById('mobile-error-msg'),
  editorItemsTbody: document.getElementById('editor-items-tbody'),
  btnAddItem: document.getElementById('btn-add-item'),
  btnOpenCatalogPicker: document.getElementById('btn-open-catalog-picker'),
  lblBtnCatalogPicker: document.getElementById('lbl-btn-catalog-picker'),
  catalogPickerModal: document.getElementById('catalog-picker-modal'),
  catalogPickerClose: document.getElementById('catalog-picker-close'),
  catalogPickerDone: document.getElementById('catalog-picker-done'),
  catalogPickerSearch: document.getElementById('catalog-picker-search'),
  catalogPickerList: document.getElementById('catalog-picker-list'),
  catalogPickerCount: document.getElementById('catalog-picker-count'),
  lblCatalogModalTitle: document.getElementById('lbl-catalog-modal-title'),
  savedProductsDatalist: document.getElementById('saved-products-datalist'),
  inputDiscount: document.getElementById('input-discount'),
  inputPaid: document.getElementById('input-paid'),
  inputPaymentMethod: document.getElementById('input-payment-method'),
  btnResetForm: document.getElementById('btn-reset-form'),
  homeStatMemos: document.getElementById('home-stat-memos'),
  homeStatSales: document.getElementById('home-stat-sales'),
  homeStatProducts: document.getElementById('home-stat-products'),
  btnHeroNewMemo: document.getElementById('btn-hero-new-memo'),
  tabShortcuts: document.querySelectorAll('[data-tab-shortcut]'),

  // Form UI labels
  lblCardGeneral: document.getElementById('lbl-card-general'),
  lblCardProducts: document.getElementById('lbl-card-products'),
  lblCardPayment: document.getElementById('lbl-card-payment'),
  lblMemoNo: document.getElementById('lbl-memo-no'),
  lblDate: document.getElementById('lbl-date'),
  lblCustomer: document.getElementById('lbl-customer'),
  lblMobile: document.getElementById('lbl-mobile'),
  lblThSl: document.getElementById('lbl-th-sl'),
  lblThProduct: document.getElementById('lbl-th-product'),
  lblThQty: document.getElementById('lbl-th-qty'),
  lblThPrice: document.getElementById('lbl-th-price'),
  lblThTotal: document.getElementById('lbl-th-total'),
  lblBtnAddItem: document.getElementById('lbl-btn-add-item'),
  lblBtnReset: document.getElementById('lbl-btn-reset'),
  lblDiscount: document.getElementById('lbl-discount'),
  lblPaid: document.getElementById('lbl-paid'),
  lblSubtotal: document.getElementById('lbl-subtotal'),
  lblDiscountDisplay: document.getElementById('lbl-discount-display'),
  lblGrandTotal: document.getElementById('lbl-grand-total'),
  lblPaidDisplay: document.getElementById('lbl-paid-display'),
  lblDueDisplay: document.getElementById('lbl-due-display'),

  // Form calculated values
  valSubtotal: document.getElementById('val-subtotal'),
  valDiscount: document.getElementById('val-discount'),
  valGrandTotal: document.getElementById('val-grand-total'),
  valPaid: document.getElementById('val-paid'),
  valDue: document.getElementById('val-due'),

  // Action buttons
  btnDownloadPng: document.getElementById('btn-download-png'),
  btnDownloadPdf: document.getElementById('btn-download-pdf'),
  btnShareMemo: document.getElementById('btn-share-memo'),
  btnSaveMemo: document.getElementById('btn-save-memo'),
  btnReloadApp: document.getElementById('btn-reload-app'),
  lblBtnPng: document.getElementById('lbl-btn-png'),
  lblBtnPdf: document.getElementById('lbl-btn-pdf'),
  lblBtnShare: document.getElementById('lbl-btn-share'),
  lblBtnSave: document.getElementById('lbl-btn-save'),

  // Mobile Action buttons
  mobileBtnPng: document.getElementById('mobile-btn-png'),
  mobileBtnShare: document.getElementById('mobile-btn-share'),
  mobileBtnSave: document.getElementById('mobile-btn-save'),

  // Live Memo Paper Preview
  previewContainerCard: document.getElementById('preview-container-card'),
  previewToolbarHeader: document.getElementById('preview-toolbar-header'),
  btnTogglePreview: document.getElementById('btn-toggle-preview'),
  lblTogglePreview: document.getElementById('lbl-toggle-preview'),
  previewCollapsedTeaser: document.getElementById('preview-collapsed-teaser'),
  teaserMemoNo: document.getElementById('teaser-memo-no'),
  teaserGrandTotal: document.getElementById('teaser-grand-total'),
  lblTeaserAction: document.getElementById('lbl-teaser-action'),

  previewViewport: document.getElementById('preview-viewport'),
  previewScaler: document.getElementById('preview-scaler'),
  memoPaper: document.getElementById('memo-paper'),
  memoHeaderLogoBox: document.getElementById('memo-header-logo-box'),
  memoHeaderLogoImg: document.getElementById('memo-header-logo-img'),
  headerLogoContainer: document.getElementById('header-logo-container'),

  pvMemoTitle: document.getElementById('pv-memo-title'),
  pvLblMemoNo: document.getElementById('pv-lbl-memo-no'),
  pvValMemoNo: document.getElementById('pv-val-memo-no'),
  pvLblDate: document.getElementById('pv-lbl-date'),
  pvValDate: document.getElementById('pv-val-date'),
  pvLblCustomer: document.getElementById('pv-lbl-customer'),
  pvValCustomer: document.getElementById('pv-val-customer'),
  pvLblMobile: document.getElementById('pv-lbl-mobile'),
  pvValMobile: document.getElementById('pv-val-mobile'),
  pvLblAddress: document.getElementById('pv-lbl-address'),
  pvValAddress: document.getElementById('pv-val-address'),

  pvThSl: document.getElementById('pv-th-sl'),
  pvThProduct: document.getElementById('pv-th-product'),
  pvThQty: document.getElementById('pv-th-qty'),
  pvThPrice: document.getElementById('pv-th-price'),
  pvThTotal: document.getElementById('pv-th-total'),
  pvItemsTbody: document.getElementById('pv-items-tbody'),

  pvLblSignature: document.getElementById('pv-lbl-signature'),
  pvLblSubtotal: document.getElementById('pv-lbl-subtotal'),
  pvValSubtotal: document.getElementById('pv-val-subtotal'),
  pvRowDiscount: document.getElementById('pv-row-discount'),
  pvLblDiscount: document.getElementById('pv-lbl-discount'),
  pvValDiscount: document.getElementById('pv-val-discount'),
  pvLblGrandTotal: document.getElementById('pv-lbl-grand-total'),
  pvValGrandTotal: document.getElementById('pv-val-grand-total'),
  pvRowPaid: document.getElementById('pv-row-paid'),
  pvLblPaid: document.getElementById('pv-lbl-paid'),
  pvValPaid: document.getElementById('pv-val-paid'),
  pvValPaymethod: document.getElementById('pv-val-paymethod'),
  pvRowAdvance: document.getElementById('pv-row-advance'),
  pvValAdvmethod: document.getElementById('pv-val-advmethod'),
  pvValAdvance: document.getElementById('pv-val-advance'),
  pvRowDue: document.getElementById('pv-row-due'),
  pvLblDue: document.getElementById('pv-lbl-due'),
  pvValDue: document.getElementById('pv-val-due'),
  pvFooterText: document.getElementById('pv-footer-text'),

  // History Tab
  statTodayCount: document.getElementById('stat-today-count'),
  statTodaySales: document.getElementById('stat-today-sales'),
  statTotalMemosCount: document.getElementById('stat-total-memos-count'),
  statTotalMemosSales: document.getElementById('stat-total-memos-sales'),
  statTotalMemosPaid: document.getElementById('stat-total-memos-paid'),
  statTotalMemosDue: document.getElementById('stat-total-memos-due'),
  lblStatCount: document.getElementById('lbl-stat-count'),
  lblStatSales: document.getElementById('lbl-stat-sales'),
  historySearchInput: document.getElementById('history-search-input'),
  historyFilterBtns: document.querySelectorAll('.history-filter-btn'),
  historyList: document.getElementById('history-list'),
  historyBadgeCount: document.getElementById('sidebar-history-count'),
  trashList: document.getElementById('trash-list'),
  trashBadgeCount: document.getElementById('sidebar-trash-count'),

  // View Memo Modal
  viewMemoModal: document.getElementById('view-memo-modal'),
  viewMemoModalClose: document.getElementById('view-memo-modal-close'),
  btnViewModalCloseBottom: document.getElementById('btn-view-modal-close-bottom'),
  btnViewModalPrint: document.getElementById('btn-view-modal-print'),
  btnViewModalPng: document.getElementById('btn-view-modal-png'),
  btnViewModalPdf: document.getElementById('btn-view-modal-pdf'),
  btnViewModalShare: document.getElementById('btn-view-modal-share'),
  btnViewModalEdit: document.getElementById('btn-view-modal-edit'),
  viewMemoPaperContainer: document.getElementById('view-memo-paper-container'),
  viewMemoScaler: document.getElementById('view-memo-scaler'),

  // Products Management Tab & Modal
  productsBadgeCount: document.getElementById('sidebar-products-count'),
  btnOpenAddProduct: document.getElementById('btn-open-add-product'),
  productSearchInput: document.getElementById('product-search-input'),
  productsTbody: document.getElementById('products-tbody'),
  productCountSummary: document.getElementById('product-count-summary'),
  productFilterBtns: document.querySelectorAll('#product-category-filters .product-filter-btn'),
  productModal: document.getElementById('product-modal'),
  productModalTitle: document.getElementById('product-modal-title'),
  productForm: document.getElementById('product-form'),
  productEditId: document.getElementById('product-edit-id'),
  modalProdName: document.getElementById('modal-prod-name'),
  modalProdCategory: document.getElementById('modal-prod-category'),
  modalProdPrice: document.getElementById('modal-prod-price'),
  modalProdUnit: document.getElementById('modal-prod-unit'),
  productModalCancel: document.getElementById('product-modal-cancel'),

  // View Product Modal
  viewProductModal: document.getElementById('view-product-modal'),
  viewProductModalClose: document.getElementById('view-product-modal-close'),
  viewProdName: document.getElementById('view-prod-name'),
  viewProdCategoryBadge: document.getElementById('view-prod-category-badge'),
  viewProdPrice: document.getElementById('view-prod-price'),
  viewProdUnit: document.getElementById('view-prod-unit'),
  viewProdCategoryText: document.getElementById('view-prod-category-text'),
  viewProdId: document.getElementById('view-prod-id'),
  btnViewProdClose: document.getElementById('btn-view-prod-close'),
  btnViewProdEdit: document.getElementById('btn-view-prod-edit'),
  btnViewProdAdd: document.getElementById('btn-view-prod-add'),

  // Profile Tab
  profilePharmacistName: document.getElementById('profile-pharmacist-name'),
  profileDlNo: document.getElementById('profile-dl-no'),
  profileTradeNo: document.getElementById('profile-trade-no'),
  profileHours: document.getElementById('profile-hours'),
  btnSaveProfile: document.getElementById('btn-save-profile'),
  profileSaveHint: document.getElementById('profile-save-hint'),
  profileLogoDisplay: document.getElementById('profile-logo-display'),

  // Report Tab
  btnReportToday: document.getElementById('btn-report-today'),
  btnReportWeek: document.getElementById('btn-report-week'),
  btnReportMonth: document.getElementById('btn-report-month'),
  btnReportAll: document.getElementById('btn-report-all'),
  reportFilterBtns: document.querySelectorAll('#tab-report .filter-btn'),
  btnPrintReport: document.getElementById('btn-print-report'),
  rptTotalMemos: document.getElementById('rpt-total-memos'),
  rptTotalSales: document.getElementById('rpt-total-sales'),
  rptTotalPaid: document.getElementById('rpt-total-paid'),
  rptTotalDue: document.getElementById('rpt-total-due'),
  rptTotalDiscount: document.getElementById('rpt-total-discount'),
  rptTopProductsTbody: document.getElementById('rpt-top-products-tbody'),
  rptRecentMemosTbody: document.getElementById('rpt-recent-memos-tbody'),
  reportCustomerSearch: document.getElementById('report-customer-search'),
  reportCustomerResults: document.getElementById('report-customer-results'),

  // Settings Tab
  settingsLangBn: document.getElementById('settings-lang-bn'),
  settingsLangEn: document.getElementById('settings-lang-en'),
  settingsThemeLight: document.getElementById('settings-theme-light'),
  settingsThemeDark: document.getElementById('settings-theme-dark'),
  settingsLogoPreview: document.getElementById('settings-logo-preview'),
  settingsLogoPlaceholder: document.getElementById('settings-logo-placeholder'),
  logoFileInput: document.getElementById('logo-file-input'),
  btnUploadLogo: document.getElementById('btn-upload-logo'),
  btnRemoveLogo: document.getElementById('btn-remove-logo'),
  settingsFooterWish: document.getElementById('settings-footer-wish'),
  btnSaveFooterWish: document.getElementById('btn-save-footer-wish'),

  // Backup Tab
  backupTotalMemos: document.getElementById('backup-total-memos'),
  backupStorageSize: document.getElementById('backup-storage-size'),
  btnBackupJson: document.getElementById('btn-backup-json'),
  btnBackupJsonTab: document.getElementById('btn-backup-json-tab'),
  restoreFileInputTab: document.getElementById('restore-file-input-tab'),
  btnRestoreJsonTab: document.getElementById('btn-restore-json-tab'),
  btnClearAllData: document.getElementById('btn-clear-all-data'),

  // App Info Tab
  appinfoInstallBtn: document.getElementById('appinfo-install-btn'),

  // Modals & Toasts
  confirmModal: document.getElementById('confirm-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalMessage: document.getElementById('modal-message'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  modalConfirmBtn: document.getElementById('modal-confirm-btn'),
  toastContainer: document.getElementById('toast-container'),

  // PWA
  pwaInstallBtn: document.getElementById('pwa-install-btn'),
  pwaBtnLabel: document.getElementById('pwa-btn-label'),
  iosGuideModal: document.getElementById('ios-guide-modal'),
  iosGuideCloseBtn: document.getElementById('ios-guide-close-btn'),
  offlineBanner: document.getElementById('offline-banner')
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${
        type === 'success'
          ? '<polyline points="20 6 9 17 4 12"></polyline>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
      }
    </svg>
    <span>${escapeHtml(message)}</span>
  `;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- MODAL CONFIRMATION HELPER ---
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    el.modalTitle.textContent = title;
    el.modalMessage.textContent = message;
    el.confirmModal.classList.add('active');

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      el.confirmModal.classList.remove('active');
      el.modalConfirmBtn.removeEventListener('click', handleConfirm);
      el.modalCancelBtn.removeEventListener('click', handleCancel);
    };

    el.modalConfirmBtn.addEventListener('click', handleConfirm);
    el.modalCancelBtn.addEventListener('click', handleCancel);
  });
}

// --- THEME LOGIC ---
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  Storage.set(STORAGE_KEYS.THEME, theme);

  if (theme === 'dark') {
    el.themeSun.style.display = 'inline-block';
    el.themeMoon.style.display = 'none';
  } else {
    el.themeSun.style.display = 'none';
    el.themeMoon.style.display = 'inline-block';
  }
}

function initTheme() {
  const stored = Storage.get(STORAGE_KEYS.THEME);
  if (stored) {
    applyTheme(stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }
}

function applyAndroidSmallMode(active) {
  if (active) {
    document.body.classList.add('android-small-mode');
    Storage.set('jp_android_small', 'true');
    showToast('অ্যান্ড্রয়েড স্মল লেআউট সক্রিয় করা হয়েছে।', 'success');
  } else {
    document.body.classList.remove('android-small-mode');
    Storage.set('jp_android_small', 'false');
    showToast('ফুল স্ক্রিন লেআউট সক্রিয় করা হয়েছে।', 'success');
  }
}

// --- LOGO LOGIC ---
function updateLogoDisplays() {
  const logo = state.customLogo;
  if (logo) {
    // Header Logo Frame
    el.headerLogoContainer.innerHTML = `<img src="${logo}" alt="Pharmacy Logo" />`;

    // Memo Header Band Logo
    el.memoHeaderLogoBox.style.display = 'flex';
    el.memoHeaderLogoImg.src = logo;

    // Settings Logo Preview
    el.settingsLogoPreview.src = logo;
    el.settingsLogoPreview.style.display = 'block';
    el.settingsLogoPlaceholder.style.display = 'none';
    el.btnRemoveLogo.style.display = 'inline-flex';

    // Sidebar & Profile Logos
    if (el.sidebarLogoContainer) {
      el.sidebarLogoContainer.innerHTML = `<img src="${logo}" alt="Logo" style="width:100%; height:100%; object-fit:cover;" />`;
    }
    if (el.profileLogoDisplay) {
      el.profileLogoDisplay.innerHTML = `<img src="${logo}" alt="Logo" style="width:100%; height:100%; object-fit:cover;" />`;
    }
  } else {
    // Revert to Default SVG Emblem
    el.headerLogoContainer.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#0f7a4a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    `;
    el.memoHeaderLogoBox.style.display = 'none';
    el.memoHeaderLogoImg.removeAttribute('src');

    el.settingsLogoPreview.style.display = 'none';
    el.settingsLogoPlaceholder.style.display = 'block';
    el.btnRemoveLogo.style.display = 'none';

    const defaultEmblem = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#0f7a4a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    `;
    if (el.sidebarLogoContainer) el.sidebarLogoContainer.innerHTML = defaultEmblem;
    if (el.profileLogoDisplay) el.profileLogoDisplay.innerHTML = defaultEmblem;
  }
}

function handleLogoUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('অনুগ্রহ করে সঠিক ছবি ফাইল নির্বাচন করুন।', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Downscale to max 256px client-side
      const maxDim = 256;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/png');
      state.customLogo = dataUrl;
      Storage.set(STORAGE_KEYS.CUSTOM_LOGO, dataUrl);
      updateLogoDisplays();
      showToast('লোগো সফলভাবে আপলোড করা হয়েছে!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleLogoRemove() {
  state.customLogo = null;
  Storage.remove(STORAGE_KEYS.CUSTOM_LOGO);
  updateLogoDisplays();
  showToast('লোগো সফলভাবে মুছে ফেলা হয়েছে।', 'success');
}

// --- LANGUAGE & TRANSLATIONS ---
function setLanguage(lang) {
  state.lang = lang;
  Storage.set(STORAGE_KEYS.LANG, lang);

  if (lang === 'bn') {
    el.langBnBtn.classList.add('active');
    el.langEnBtn.classList.remove('active');
    document.documentElement.lang = 'bn';
  } else {
    el.langBnBtn.classList.remove('active');
    el.langEnBtn.classList.add('active');
    document.documentElement.lang = 'en';
  }

  const t = TRANSLATIONS[lang];

  // Update Form Labels
  el.lblCardGeneral.textContent = t.generalInfoTitle;
  el.lblCardProducts.textContent = t.productsTitle;
  el.lblCardPayment.textContent = t.paymentTitle;
  el.lblMemoNo.textContent = t.memoNoLabel;
  el.lblDate.textContent = t.dateLabel;
  el.lblCustomer.textContent = t.customerLabel;
  el.lblMobile.textContent = t.mobileLabel;
  el.lblThSl.textContent = t.slLabel;
  el.lblThProduct.textContent = t.productLabel;
  el.lblThQty.textContent = t.qtyLabel;
  el.lblThPrice.textContent = `${t.priceLabel} (৳)`;
  el.lblThTotal.textContent = `${t.totalLabel} (৳)`;
  el.lblBtnAddItem.textContent = t.addItemBtn;
  if (el.lblBtnCatalogPicker) el.lblBtnCatalogPicker.textContent = lang === 'bn' ? 'ক্যাটালগ থেকে পিক করুন' : 'Pick from Catalog';
  if (el.lblCatalogModalTitle) el.lblCatalogModalTitle.textContent = lang === 'bn' ? 'ক্যাটালগ থেকে প্রোডাক্ট নির্বাচন করুন' : 'Select Product from Catalog';
  el.lblBtnReset.textContent = t.resetBtn;
  el.lblDiscount.textContent = `${t.discountLabel} (৳)`;
  el.lblPaid.textContent = `${t.paidLabel} (৳)`;
  el.lblSubtotal.textContent = `${t.subtotalLabel}:`;
  el.lblDiscountDisplay.textContent = `${t.discountLabel}:`;
  el.lblGrandTotal.textContent = `${t.grandTotalLabel}:`;
  el.lblPaidDisplay.textContent = `${t.paidLabel}:`;
  el.lblDueDisplay.textContent = `${t.dueLabel}:`;

  // Action Buttons
  if (el.lblBtnPng) el.lblBtnPng.textContent = t.downloadPngBtn;
  if (el.lblBtnPdf) el.lblBtnPdf.textContent = t.downloadPdfBtn;
  if (el.lblBtnShare) el.lblBtnShare.textContent = t.shareBtn;
  if (el.lblBtnSave) el.lblBtnSave.textContent = t.saveBtn;

  // Memo Paper Labels (The fixed business info stays in English)
  el.pvMemoTitle.textContent = t.memoTitle;
  el.pvLblMemoNo.textContent = `${t.memoNoLabel}:`;
  el.pvLblDate.textContent = `${t.dateLabel}:`;
  el.pvLblCustomer.textContent = `${t.customerLabel}:`;
  el.pvLblMobile.textContent = `${t.mobileLabel}:`;

  el.pvThSl.textContent = t.slLabel;
  el.pvThProduct.textContent = t.productLabel;
  el.pvThQty.textContent = t.qtyLabel;
  el.pvThPrice.textContent = t.priceLabel;
  el.pvThTotal.textContent = t.totalLabel;

  el.pvLblSignature.textContent = t.signatureLabel;
  el.pvLblSubtotal.textContent = t.subtotalLabel;
  el.pvLblDiscount.textContent = t.discountLabel;
  el.pvLblGrandTotal.textContent = t.grandTotalLabel;
  el.pvLblPaid.textContent = t.paidLabel;
  el.pvLblDue.textContent = t.dueLabel;
  el.pvFooterText.textContent = t.footerText;

  renderFormItems();
  updateLivePreview();
  updatePreviewCollapseUI();
  validateMobileNumberInput(true);
}

// --- FORM RENDERING & BINDING ---
function renderFormItems() {
  el.editorItemsTbody.innerHTML = '';
  const isBn = state.lang === 'bn';

  state.items.forEach((item, index) => {
    const tr = document.createElement('tr');
    const slDisplay = isBn ? toBanglaDigits(index + 1) : String(index + 1);
    const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);

    tr.innerHTML = `
      <td class="row-index">${slDisplay}</td>
      <td>
        <input type="text" class="form-input item-input-name" data-id="${item.id}" value="${escapeHtml(item.name)}" placeholder="${isBn ? 'প্রোডাক্টের নাম লিখুন (বা লিস্ট থেকে বাছাই)' : 'Enter name (or select saved)'}" list="saved-products-datalist" autocomplete="off" />
      </td>
      <td>
        <input type="number" class="form-input item-input-qty" data-id="${item.id}" value="${escapeHtml(item.qty)}" min="0" step="any" inputmode="decimal" placeholder="1" />
      </td>
      <td>
        <input type="number" class="form-input item-input-price" data-id="${item.id}" value="${escapeHtml(item.price)}" min="0" step="any" inputmode="decimal" placeholder="0" />
      </td>
      <td style="font-weight: 600; text-align: right; padding-right: 0.75rem;">
        ${formatMoney(lineTotal, state.lang)}
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-delete-row" data-id="${item.id}" title="${isBn ? 'মুছুন' : 'Delete'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    el.editorItemsTbody.appendChild(tr);
  });

  // Re-attach listeners for item row inputs
  attachItemEventListeners();
}

function attachItemEventListeners() {
  const nameInputs = el.editorItemsTbody.querySelectorAll('.item-input-name');
  const qtyInputs = el.editorItemsTbody.querySelectorAll('.item-input-qty');
  const priceInputs = el.editorItemsTbody.querySelectorAll('.item-input-price');
  const deleteBtns = el.editorItemsTbody.querySelectorAll('.btn-delete-row');

  nameInputs.forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const val = e.target.value;
      const item = state.items.find((it) => it.id === id);
      if (item) {
        item.name = val;
        // Auto match with saved products catalog
        const savedProds = getSavedProducts();
        const matched = savedProds.find((p) => p.name.trim().toLowerCase() === val.trim().toLowerCase());
        if (matched) {
          item.price = matched.price !== undefined ? String(matched.price) : item.price;
          if (!item.qty || parseFloat(item.qty) <= 0) {
            item.qty = '1';
          }
          const tr = e.target.closest('tr');
          if (tr) {
            const priceInp = tr.querySelector('.item-input-price');
            const qtyInp = tr.querySelector('.item-input-qty');
            if (priceInp) priceInp.value = item.price;
            if (qtyInp) qtyInp.value = item.qty;
          }
        }
      }
      updateLivePreview();
      updateLineTotalDisplay(e.target);
    });
  });

  qtyInputs.forEach((inp) => {
    inp.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    inp.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = state.items.find((it) => it.id === id);
      if (item) item.qty = e.target.value;
      updateLivePreview();
      updateLineTotalDisplay(e.target);
    });
  });

  priceInputs.forEach((inp) => {
    inp.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    inp.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = state.items.find((it) => it.id === id);
      if (item) item.price = e.target.value;
      updateLivePreview();
      updateLineTotalDisplay(e.target);
    });
  });

  deleteBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      if (state.items.length <= 1) {
        state.items = [{ id: 'item_' + Date.now(), name: '', qty: '', price: '' }];
      } else {
        state.items = state.items.filter((it) => it.id !== id);
      }
      renderFormItems();
      updateLivePreview();
    });
  });
}

function updateLineTotalDisplay(targetInput) {
  const tr = targetInput.closest('tr');
  if (!tr) return;
  const id = targetInput.getAttribute('data-id');
  const item = state.items.find((it) => it.id === id);
  if (!item) return;

  const totalCell = tr.children[4];
  const q = parseFloat(item.qty) || 0;
  const p = parseFloat(item.price) || 0;
  totalCell.textContent = formatMoney(q * p, state.lang);
}

function addItemRow() {
  const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  state.items.push({ id: newId, name: '', qty: '', price: '' });
  renderFormItems();
  updateLivePreview();
}

// --- LIVE PREVIEW UPDATE ---
function updateLivePreview() {
  const isBn = state.lang === 'bn';

  // 1. Memo Number
  const currentMemoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
  el.pvValMemoNo.textContent = isBn ? toBanglaDigits(currentMemoNo) : currentMemoNo;

  // 2. Date
  el.pvValDate.textContent = formatDateDisplay(state.currentDate, state.lang);

  // 3. Customer Info
  el.pvValCustomer.textContent = state.customerName.trim() || '—';
  el.pvValMobile.textContent = state.customerMobile.trim()
    ? isBn
      ? toBanglaDigits(state.customerMobile.trim())
      : state.customerMobile.trim()
    : '—';
  el.pvValAddress.textContent = state.customerAddress.trim() || '—';

  // 4. Products Table
  const validItems = state.items.filter(
    (it) => it.name.trim() !== '' || (Number(it.qty) > 0 && Number(it.price) > 0)
  );

  el.pvItemsTbody.innerHTML = '';
  if (validItems.length === 0) {
    el.pvItemsTbody.innerHTML = `
      <tr>
        <td class="col-sl">—</td>
        <td style="color: #9ca3af; font-style: italic;">${isBn ? 'কোনো প্রোডাক্ট যোগ করা হয়নি' : 'No products added'}</td>
        <td class="col-qty">—</td>
        <td class="col-price">—</td>
        <td class="col-total">—</td>
      </tr>
    `;
  } else {
    validItems.forEach((item, idx) => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.price) || 0;
      const rowTotal = q * p;

      const slText = isBn ? toBanglaDigits(idx + 1) : String(idx + 1);
      const qtyText = q > 0 ? (isBn ? toBanglaDigits(q) : String(q)) : '—';
      const priceText = p > 0 ? formatMoney(p, state.lang) : '—';
      const totalText = formatMoney(rowTotal, state.lang);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-sl">${slText}</td>
        <td><strong>${escapeHtml(item.name || '—')}</strong></td>
        <td class="col-qty">${qtyText}</td>
        <td class="col-price">${priceText}</td>
        <td class="col-total">${totalText}</td>
      `;
      el.pvItemsTbody.appendChild(tr);
    });
  }

  // 5. Calculations
  const totals = state.calculateTotals();

  // Summary Card in Editor Form
  el.valSubtotal.textContent = formatMoney(totals.subtotal, state.lang);
  el.valDiscount.textContent = formatMoney(totals.discount, state.lang);
  el.valGrandTotal.textContent = formatMoney(totals.grandTotal, state.lang);
  el.valPaid.textContent = formatMoney(totals.paid, state.lang);
  el.valDue.textContent = formatMoney(totals.due, state.lang);

  // Memo Paper Totals
  el.pvValSubtotal.textContent = formatMoney(totals.subtotal, state.lang);

  if (totals.discount > 0) {
    el.pvRowDiscount.style.display = 'flex';
    el.pvValDiscount.textContent = formatMoney(totals.discount, state.lang);
  } else {
    el.pvRowDiscount.style.display = 'none';
  }

  el.pvValGrandTotal.textContent = formatMoney(totals.grandTotal, state.lang);

  if (totals.paid > 0) {
    el.pvRowPaid.style.display = 'flex';
    el.pvValPaid.textContent = formatMoney(totals.paid, state.lang);

    el.pvRowDue.style.display = 'flex';
    el.pvValDue.textContent = formatMoney(totals.due, state.lang);
  } else {
    el.pvRowPaid.style.display = 'none';
    el.pvRowDue.style.display = 'none';
  }

  const payMethodLabels = {
    cash: state.lang === 'bn' ? 'নগদ' : 'Cash',
    mobile_banking: state.lang === 'bn' ? 'মোবাইল ব্যাংকিং' : 'Mobile Banking',
    cod: state.lang === 'bn' ? 'COD' : 'COD'
  };
  const advMethodLabels = {
    bkash: state.lang === 'bn' ? 'বিকাশ' : 'bKash',
    nagad: state.lang === 'bn' ? 'নগদ' : 'Nagad',
    rocket: state.lang === 'bn' ? 'রকেট' : 'Rocket',
    bank: state.lang === 'bn' ? 'ব্যাংক' : 'Bank'
  };

  if (el.pvValPaymethod) {
    el.pvValPaymethod.textContent = payMethodLabels[state.paymentMethod] || 'নগদ';
  }

  const advanceVal = Math.max(0, parseFloat(state.advanceAmount) || 0);
  if (advanceVal > 0) {
    if (el.pvRowAdvance) el.pvRowAdvance.style.display = 'flex';
    if (el.pvValAdvmethod) el.pvValAdvmethod.textContent = advMethodLabels[state.advanceMethod] || 'বিকাশ';
    if (el.pvValAdvance) el.pvValAdvance.textContent = formatMoney(advanceVal, state.lang);
  } else {
    if (el.pvRowAdvance) el.pvRowAdvance.style.display = 'none';
  }

  // Update collapsed teaser information
  const t = TRANSLATIONS[state.lang];
  el.teaserMemoNo.textContent = `${t.memoNoLabel}: ${isBn ? toBanglaDigits(currentMemoNo) : currentMemoNo}`;
  el.teaserGrandTotal.textContent = formatMoney(totals.grandTotal, state.lang);

  // Adjust Responsive Scaler
  fitPreviewScale();
}

// Toggle Collapsed / Expanded state of Live Memo Preview
function togglePreviewCollapse(forceState = null) {
  if (forceState !== null) {
    state.previewCollapsed = forceState;
  } else {
    state.previewCollapsed = !state.previewCollapsed;
  }

  Storage.set('jp_preview_collapsed', String(state.previewCollapsed));
  updatePreviewCollapseUI();

  if (!state.previewCollapsed) {
    setTimeout(fitPreviewScale, 60);
  }
}

function updatePreviewCollapseUI() {
  const isCollapsed = state.previewCollapsed;
  const t = TRANSLATIONS[state.lang];

  if (isCollapsed) {
    el.previewContainerCard.classList.add('collapsed');
    el.btnTogglePreview.setAttribute('aria-expanded', 'false');
    el.lblTogglePreview.textContent = t.previewShow;
  } else {
    el.previewContainerCard.classList.remove('collapsed');
    el.btnTogglePreview.setAttribute('aria-expanded', 'true');
    el.lblTogglePreview.textContent = t.previewHide;
  }

  const isBn = state.lang === 'bn';
  const currentMemoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
  el.teaserMemoNo.textContent = `${t.memoNoLabel}: ${isBn ? toBanglaDigits(currentMemoNo) : currentMemoNo}`;

  const totals = state.calculateTotals();
  el.teaserGrandTotal.textContent = formatMoney(totals.grandTotal, state.lang);
  el.lblTeaserAction.textContent = t.teaserAction;
}

// Fit 800px memo neatly into container on mobile & small screens
function fitPreviewScale() {
  if (state.previewCollapsed) return;
  const containerWidth = el.previewViewport.clientWidth - 32; // padding
  if (containerWidth <= 0) return;
  const baseWidth = 800;
  const scale = Math.min(1, Math.max(0.35, containerWidth / baseWidth));

  el.previewScaler.style.transform = `scale(${scale})`;
  const memoHeight = el.memoPaper.offsetHeight || 1080;
  el.previewViewport.style.height = `${memoHeight * scale + 36}px`;
}

// --- MOBILE NUMBER VALIDATION (MINIMUM 11 DIGITS) ---
function validateMobileNumberInput(showVisuals = true) {
  const raw = (state.customerMobile || '').trim();
  const isBn = state.lang === 'bn';

  if (!raw) {
    if (showVisuals && el.mobileDigitsCounter && el.mobileErrorMsg) {
      el.mobileDigitsCounter.textContent = isBn ? '(মিনিমাম ১১ ডিজিট)' : '(Min 11 digits)';
      el.mobileDigitsCounter.style.color = 'var(--text-muted)';
      el.mobileErrorMsg.style.display = 'none';
      if (el.inputCustomerMobile) {
        el.inputCustomerMobile.classList.remove('input-error', 'input-success');
      }
    }
    return { valid: true, count: 0, isEmpty: true };
  }

  const digits = extractMobileDigits(raw);
  const count = digits.length;

  if (count < 11) {
    if (showVisuals && el.mobileDigitsCounter && el.mobileErrorMsg) {
      el.mobileDigitsCounter.textContent = isBn
        ? `(${toBanglaDigits(count)}/১১ ডিজিট)`
        : `(${count}/11 digits)`;
      el.mobileDigitsCounter.style.color = 'var(--danger)';
      el.mobileErrorMsg.textContent = isBn
        ? `মোবাইল নম্বর কমপক্ষে ১১ ডিজিট হতে হবে (আরও ${toBanglaDigits(11 - count)} ডিজিট বাকি)`
        : `Must be at least 11 digits (${11 - count} more needed)`;
      el.mobileErrorMsg.style.display = 'block';
      if (el.inputCustomerMobile) {
        el.inputCustomerMobile.classList.add('input-error');
        el.inputCustomerMobile.classList.remove('input-success');
      }
    }
    return {
      valid: false,
      count,
      isEmpty: false,
      message: isBn
        ? `মোবাইল নম্বর সঠিক নয়! মিনিমাম ১১ ডিজিট না হলে Mobile নাম্বার সেভ হবে না (বর্তমানে ${toBanglaDigits(count)} ডিজিট)।`
        : `Invalid mobile number! Must be minimum 11 digits to save (currently ${count} digits).`
    };
  } else {
    if (showVisuals && el.mobileDigitsCounter && el.mobileErrorMsg) {
      el.mobileDigitsCounter.textContent = isBn
        ? `✓ ${toBanglaDigits(count)} ডিজিট (সঠিক)`
        : `✓ ${count} digits (Valid)`;
      el.mobileDigitsCounter.style.color = 'var(--success)';
      el.mobileErrorMsg.style.display = 'none';
      if (el.inputCustomerMobile) {
        el.inputCustomerMobile.classList.remove('input-error');
        el.inputCustomerMobile.classList.add('input-success');
      }
    }
    return { valid: true, count, isEmpty: false };
  }
}

function validateMobileForSave() {
  const check = validateMobileNumberInput(true);
  if (!check.valid) {
    if (el.inputCustomerMobile) {
      el.inputCustomerMobile.classList.add('shake-animation');
      setTimeout(() => el.inputCustomerMobile.classList.remove('shake-animation'), 400);
      el.inputCustomerMobile.focus();
    }
    showToast(check.message, 'danger');
    return false;
  }
  return true;
}

// --- FORM RESET & INITIALIZATION ---
function resetForm(keepDate = true) {
  if (!keepDate) {
    state.currentDate = getTodayDateString();
    el.inputDate.value = state.currentDate;
  }
  state.customerName = '';
  state.customerMobile = '';
  state.customerAddress = '';
  state.discount = 0;
  state.paid = 0;
  state.paymentMethod = 'cash';
  state.initDefaultItems();

  el.inputCustomerName.value = '';
  el.inputCustomerMobile.value = '';
  if (el.inputCustomerAddress) el.inputCustomerAddress.value = '';
  el.inputDiscount.value = '';
  el.inputPaid.value = '';
  if (el.inputPaymentMethod) el.inputPaymentMethod.value = 'cash';

  const suggested = state.getSuggestedMemoNo(state.currentDate);
  el.inputMemoNo.value = suggested;

  renderFormItems();
  updateLivePreview();
  validateMobileNumberInput(true);
}

// --- EXPORT & SHARE LOGIC ---
async function renderMemoToCanvas() {
  await document.fonts.ready;

  // Clone #memo-paper into an unscaled hidden node for pristine 800px render
  const clone = el.memoPaper.cloneNode(true);
  clone.id = 'memo-paper-clone';
  clone.style.transform = 'none';
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.width = '800px';
  clone.style.zIndex = '-1000';
  clone.style.backgroundColor = '#ffffff';

  document.body.appendChild(clone);

  try {
    const canvas = await window.html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    return canvas;
  } finally {
    clone.remove();
  }
}

async function handleDownloadPng() {
  if (!validateMobileForSave()) return;

  const validItems = state.items.filter((it) => it.name.trim() !== '');
  if (validItems.length === 0) {
    showToast(TRANSLATIONS[state.lang].emptyProductWarning, 'danger');
    return;
  }

  showToast('PNG তৈরি হচ্ছে...', 'success');
  try {
    const canvas = await renderMemoToCanvas();
    const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
    const cleanMemoNo = memoNo.replace(/[^a-zA-Z0-9-_]/g, '');
    const fileName = `Jononi-Memo-${cleanMemoNo}-${state.lang}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Commit memo number and save history
    saveCurrentMemoToHistory();
    state.commitMemoNumber(state.currentDate, memoNo);
    el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);
    updateLivePreview();
    updateHistoryTab();

    showToast(TRANSLATIONS[state.lang].pngSuccess, 'success');
  } catch (err) {
    console.error('PNG Error:', err);
    showToast('PNG তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'danger');
  }
}



async function handleShareMemo() {
  if (!validateMobileForSave()) return;

  const validItems = state.items.filter((it) => it.name.trim() !== '');
  if (validItems.length === 0) {
    showToast(TRANSLATIONS[state.lang].emptyProductWarning, 'danger');
    return;
  }

  showToast('শেয়ারের জন্য ফাইল প্রস্তুত হচ্ছে...', 'success');
  try {
    const canvas = await renderMemoToCanvas();
    const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
    const cleanMemoNo = memoNo.replace(/[^a-zA-Z0-9-_]/g, '');
    const fileName = `Jononi-Memo-${cleanMemoNo}-${state.lang}.png`;

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Jononi Pharmacy Memo - ${memoNo}`,
            text: `Cash Memo ${memoNo} from Jononi Enterprise And Healthcare`,
            files: [file]
          });
          // Commit and save upon successful share
          saveCurrentMemoToHistory();
          state.commitMemoNumber(state.currentDate, memoNo);
          el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);
          updateLivePreview();
          updateHistoryTab();
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') {
            // User cancelled share dialog smoothly
            return;
          }
          console.warn('Share error:', shareErr);
          fallbackShareDownload(canvas, fileName);
        }
      } else {
        fallbackShareDownload(canvas, fileName);
      }
    }, 'image/png');
  } catch (err) {
    console.error('Share generation error:', err);
    showToast('শেয়ার প্রস্তুত করতে সমস্যা হয়েছে।', 'danger');
  }
}

function fallbackShareDownload(canvas, fileName) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast(TRANSLATIONS[state.lang].shareFallback, 'success');

  const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
  saveCurrentMemoToHistory();
  state.commitMemoNumber(state.currentDate, memoNo);
  el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);
  updateLivePreview();
  updateHistoryTab();
}

async function handleDownloadPdf() {
  if (!validateMobileForSave()) return;

  const validItems = state.items.filter((it) => it.name.trim() !== '');
  if (validItems.length === 0) {
    showToast(TRANSLATIONS[state.lang].emptyProductWarning, 'danger');
    return;
  }

  showToast('PDF ফাইল তৈরি হচ্ছে...', 'success');
  try {
    const canvas = await renderMemoToCanvas();
    const { jsPDF } = window.jspdf;
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    const imgWidth = 148;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
    const cleanMemoNo = memoNo.replace(/[^a-zA-Z0-9-_]/g, '');
    const fileName = `Jononi-Memo-${cleanMemoNo}-${state.lang}.pdf`;

    pdf.save(fileName);

    saveCurrentMemoToHistory();
    state.commitMemoNumber(state.currentDate, memoNo);
    el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);
    updateLivePreview();
    updateHistoryTab();

    showToast(TRANSLATIONS[state.lang].pdfSuccess, 'success');
  } catch (err) {
    console.error('PDF Error:', err);
    showToast('PDF তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'danger');
  }
}

function handleSaveMemo() {
  if (!validateMobileForSave()) return;

  const validItems = state.items.filter((it) => it.name.trim() !== '');
  if (validItems.length === 0) {
    showToast(TRANSLATIONS[state.lang].emptyProductWarning, 'danger');
    return;
  }

  const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);
  saveCurrentMemoToHistory();
  state.commitMemoNumber(state.currentDate, memoNo);
  el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);
  updateLivePreview();
  updateHistoryTab();
  
  // 1. Expand memo paper preview automatically
  togglePreviewCollapse(false);
  
  // 2. Scroll smoothly to preview memo paper
  setTimeout(() => {
    const memoPaperEl = document.getElementById('memo-paper');
    if (memoPaperEl) {
      memoPaperEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);

  showToast(TRANSLATIONS[state.lang].savedSuccess, 'success');
}

// --- HISTORY LOGIC (Google Firebase Cloud Storage) ---
function getSavedHistory() {
  return cloudMemos;
}

async function saveCurrentMemoToHistory() {
  if (!auth.currentUser) {
    showToast('গুগল ফায়ারবেসে মেমো সেভ করতে অনুগ্রহ করে প্রথমে সাইন-ইন করুন।', 'danger');
    try {
      await loginWithGoogle();
    } catch {
      return;
    }
  }

  const totals = state.calculateTotals();
  const memoNo = el.inputMemoNo.value.trim() || state.getSuggestedMemoNo(state.currentDate);

  // Guarantee that mobile number is only saved if it has minimum 11 digits
  const mobileDigits = extractMobileDigits(state.customerMobile.trim());
  const finalMobile = mobileDigits.length >= 11 ? state.customerMobile.trim() : '';

  const memoData = {
    id: 'memo_' + Date.now(),
    memoNo,
    date: state.currentDate,
    lang: state.lang,
    customerName: state.customerName.trim(),
    customerMobile: finalMobile,
    customerAddress: state.customerAddress.trim(),
    items: JSON.parse(JSON.stringify(state.items)),
    discount: totals.discount,
    paid: totals.paid,
    paymentMethod: state.paymentMethod,
    subtotal: totals.subtotal,
    grandTotal: totals.grandTotal,
    due: totals.due,
    createdAt: new Date().toISOString()
  };

  try {
    await saveMemoToCloud(memoData);
    showToast('মেমো সফলভাবে গুগল ফায়ারবেসে সংরক্ষিত হয়েছে!', 'success');
  } catch (err) {
    console.error('Firebase save error:', err);
    showToast('ফায়ারবেসে মেমো সেভ করতে সমস্যা হয়েছে।', 'danger');
  }
}

async function deleteMemoFromHistory(memoId) {
  if (!auth.currentUser) {
    showToast('লগইন প্রয়োজন।', 'danger');
    return;
  }
  const memo = cloudMemos.find((m) => m.id === memoId);
  try {
    await deleteMemoFromCloud(memoId, memo);
    showToast('মেমোটি গুগল ক্লাউড রিসাইকেল বিনে সরানো হয়েছে।', 'success');
  } catch (err) {
    console.error('Cloud delete error:', err);
    showToast('মেমো মুছতে সমস্যা হয়েছে।', 'danger');
  }
}


function reopenMemo(memoData) {
  state.lang = memoData.lang || 'bn';
  state.currentDate = memoData.date || getTodayDateString();
  state.memoNo = memoData.memoNo;
  state.customerName = memoData.customerName || '';
  state.customerMobile = memoData.customerMobile || '';
  state.customerAddress = memoData.customerAddress || '';
  state.items = memoData.items && memoData.items.length > 0 ? memoData.items : [];
  state.discount = memoData.discount || 0;
  state.paid = memoData.paid || 0;
  state.paymentMethod = memoData.paymentMethod || 'cash';

  // Set UI input values
  el.inputDate.value = state.currentDate;
  el.inputMemoNo.value = state.memoNo;
  el.inputCustomerName.value = state.customerName;
  el.inputCustomerMobile.value = state.customerMobile;
  if (el.inputCustomerAddress) el.inputCustomerAddress.value = state.customerAddress;
  el.inputDiscount.value = state.discount > 0 ? state.discount : '';
  el.inputPaid.value = state.paid > 0 ? state.paid : '';
  if (el.inputPaymentMethod) el.inputPaymentMethod.value = state.paymentMethod;

  setLanguage(state.lang);
  validateMobileNumberInput(true);
  switchTab('tab-editor');
  showToast(`মেমো নং ${memoData.memoNo} পুনরায় খোলা হয়েছে।`, 'success');
}

let currentHistoryFilter = 'all';
let currentViewingMemo = null;

function setHistoryFilter(filter) {
  currentHistoryFilter = filter;
  if (el.historyFilterBtns) {
    el.historyFilterBtns.forEach((btn) => {
      if (btn.getAttribute('data-filter') === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  renderHistoryList(getSavedHistory());
}

function updateHistoryTab() {
  const history = getSavedHistory();

  // Update badge count
  if (el.historyBadgeCount) {
    el.historyBadgeCount.textContent = state.lang === 'bn' ? toBanglaDigits(history.length) : history.length;
  }

  // Calculate statistics across all history
  let totalMemosCount = history.length;
  let totalSales = 0;
  let totalPaid = 0;
  let totalDue = 0;

  history.forEach((m) => {
    totalSales += parseFloat(m.grandTotal) || 0;
    totalPaid += parseFloat(m.paid) || 0;
    totalDue += parseFloat(m.due) || 0;
  });

  if (el.statTotalMemosCount) {
    el.statTotalMemosCount.textContent = state.lang === 'bn' ? toBanglaDigits(totalMemosCount) : String(totalMemosCount);
  }
  if (el.statTotalMemosSales) {
    el.statTotalMemosSales.textContent = formatMoney(totalSales, state.lang);
  }
  if (el.statTotalMemosPaid) {
    el.statTotalMemosPaid.textContent = formatMoney(totalPaid, state.lang);
  }
  if (el.statTotalMemosDue) {
    el.statTotalMemosDue.textContent = formatMoney(totalDue, state.lang);
  }

  renderHistoryList(history);
}

function updateRecycleBinTab() {
  const trash = cloudTrash;

  if (el.trashBadgeCount) {
    el.trashBadgeCount.textContent = state.lang === 'bn' ? toBanglaDigits(trash.length) : trash.length;
  }

  el.trashList.innerHTML = '';
  if (trash.length === 0) {
    el.trashList.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">${state.lang === 'bn' ? 'রিসাইকেল বিন খালি' : 'Recycle Bin is empty'}</div>`;
    return;
  }

  trash.forEach((itemDoc) => {
    const memo = itemDoc.memoData || itemDoc;
    const item = document.createElement('div');
    item.className = 'history-item';
    const memoDisplayNo = state.lang === 'bn' ? toBanglaDigits(memo.memoNo) : memo.memoNo;
    const dateDisplay = formatDateDisplay(memo.date, state.lang);
    const amountDisplay = formatMoney(memo.grandTotal, state.lang);
    const docId = itemDoc.id || memo.id;

    item.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-top">
          <span class="history-memo-no">${memoDisplayNo}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">${dateDisplay}</span>
        </div>
        <div style="font-weight: 700;">${amountDisplay}</div>
      </div>
      <div class="history-item-actions">
        <button type="button" class="btn btn-outline btn-sm btn-restore" data-id="${docId}">রিস্টোর</button>
        <button type="button" class="btn btn-outline btn-sm btn-delete-forever" data-id="${docId}" style="color: var(--danger);">স্থায়ীভাবে মুছুন</button>
      </div>
    `;
    el.trashList.appendChild(item);
  });

  el.trashList.querySelectorAll('.btn-restore').forEach(btn => {
    btn.addEventListener('click', () => restoreFromTrash(btn.dataset.id));
  });
  el.trashList.querySelectorAll('.btn-delete-forever').forEach(btn => {
    btn.addEventListener('click', () => deleteFromTrashForever(btn.dataset.id));
  });
}

async function restoreFromTrash(trashId) {
  if (!auth.currentUser) return;
  const match = cloudTrash.find(m => m.id === trashId || (m.memoData && m.memoData.id === trashId));
  if (match) {
    const memoToRestore = match.memoData || match;
    try {
      await saveMemoToCloud(memoToRestore);
      await purgeTrashFromCloud(trashId);
      showToast('মেমোটি ক্লাউডে সফলভাবে পুনরুদ্ধার করা হয়েছে!', 'success');
    } catch (err) {
      console.error('Restore error:', err);
      showToast('রিস্টোর করতে সমস্যা হয়েছে।', 'danger');
    }
  }
}

async function deleteFromTrashForever(trashId) {
  if (!auth.currentUser) return;
  try {
    await purgeTrashFromCloud(trashId);
    showToast('মেমোটি ক্লাউড থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।', 'success');
  } catch (err) {
    console.error('Delete forever error:', err);
  }
}


function renderHistoryList(history) {
  if (!el.historyList) return;
  const query = el.historySearchInput ? el.historySearchInput.value.trim().toLowerCase() : '';
  const isBn = state.lang === 'bn';
  el.historyList.innerHTML = '';

  const filtered = history.filter((m) => {
    // Search query filter
    let matchesQuery = true;
    if (query) {
      const memoNo = (m.memoNo || '').toLowerCase();
      const memoNoBn = toBanglaDigits(m.memoNo || '');
      const cust = (m.customerName || '').toLowerCase();
      const mob = (m.customerMobile || '').toLowerCase();
      matchesQuery = memoNo.includes(query) || memoNoBn.includes(query) || cust.includes(query) || mob.includes(query);
    }

    // Status filter
    let matchesStatus = true;
    const dueVal = parseFloat(m.due) || 0;
    if (currentHistoryFilter === 'paid') {
      matchesStatus = dueVal <= 0;
    } else if (currentHistoryFilter === 'due') {
      matchesStatus = dueVal > 0;
    }

    return matchesQuery && matchesStatus;
  });

  if (filtered.length === 0) {
    el.historyList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 0.85rem; opacity: 0.5; color: var(--text-muted);">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.25rem;">
          ${isBn ? 'কোনো মেমো পাওয়া যায়নি' : 'No memos found'}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          ${query ? (isBn ? 'অনুগ্রহ করে ভিন্ন মেমো নম্বর বা নাম দিয়ে খুঁজুন।' : 'Try searching with a different term.') : (isBn ? 'নতুন মেমো তৈরি করলে এখানে সংরক্ষিত থাকবে।' : 'Created memos will appear here.')}
        </p>
      </div>
    `;
    return;
  }

  filtered.forEach((memo) => {
    const card = document.createElement('div');
    const dueVal = parseFloat(memo.due) || 0;
    const isPaid = dueVal <= 0;
    card.className = `history-memo-card ${isPaid ? 'status-paid' : 'status-due'}`;

    const memoDisplayNo = isBn ? toBanglaDigits(memo.memoNo) : memo.memoNo;
    const dateDisplay = formatDateDisplay(memo.date, state.lang);
    const grandTotalDisplay = formatMoney(memo.grandTotal, state.lang);
    const paidDisplay = formatMoney(memo.paid, state.lang);
    const dueDisplay = formatMoney(dueVal, state.lang);
    const langBadge = memo.lang === 'en' ? 'EN' : 'বাংলা';

    const statusPillHtml = isPaid
      ? `<span class="status-pill paid">✓ ${isBn ? 'পরিশোধিত' : 'Paid'}</span>`
      : `<span class="status-pill due">⚠ ${isBn ? `বাকি ${dueDisplay}` : `Due ${dueDisplay}`}</span>`;

    // Items summary text
    const itemsList = memo.items || [];
    const itemNamesList = itemsList.map(it => it.name).filter(n => n && n.trim()).slice(0, 3).join(', ');
    const itemsSummary = itemsList.length > 0
      ? `${isBn ? toBanglaDigits(itemsList.length) : itemsList.length} ${isBn ? 'টি প্রোডাক্ট' : 'items'} ${itemNamesList ? `(${escapeHtml(itemNamesList)}${itemsList.length > 3 ? '...' : ''})` : ''}`
      : (isBn ? 'কোনো প্রোডাক্ট তথ্য নেই' : 'No items');

    card.innerHTML = `
      <!-- Card Header -->
      <div class="history-card-header">
        <div>
          <div class="history-card-memo-no">মেমো নং: ${memoDisplayNo}</div>
          <div class="history-card-date">তারিখ: ${dateDisplay}</div>
        </div>
        <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
          <span class="history-badge" style="font-size: 0.72rem;">${langBadge}</span>
          ${statusPillHtml}
        </div>
      </div>

      <!-- Customer Details -->
      <div class="history-card-customer">
        <div class="history-card-customer-name">👤 ${escapeHtml(memo.customerName || 'গ্রাহকের নাম নেই')}</div>
        <div class="history-card-customer-sub">
          📞 ${memo.customerMobile ? escapeHtml(memo.customerMobile) : 'মোবাইল নম্বর নেই'}
          ${memo.customerAddress ? ` • 📍 ${escapeHtml(memo.customerAddress)}` : ''}
        </div>
      </div>

      <!-- Products Summary -->
      <div class="history-card-items-preview">
        <span style="font-weight: 600; color: var(--text-main);">📦 প্রোডাক্ট বিবরণ:</span>
        <span>${itemsSummary}</span>
      </div>

      <!-- Financial Totals -->
      <div class="history-card-totals">
        <div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">মেমোর মোট বিল</div>
          <div class="history-card-amount">${grandTotalDisplay}</div>
        </div>
        <div style="text-align: right; font-size: 0.82rem; font-weight: 600;">
          <div style="color: var(--primary);">এডভ্যান্স/জমা: ${paidDisplay}</div>
          ${dueVal > 0 ? `<div style="color: var(--danger); font-weight: 700;">বাকি বিল: ${dueDisplay}</div>` : `<div style="color: var(--success); font-weight: 700;">✓ বকেয়া নেই</div>`}
        </div>
      </div>

      <!-- 4 Action Buttons Row -->
      <div class="history-card-actions">
        <button type="button" class="btn-card-view" title="${isBn ? 'মেমো প্রিভিউ দেখুন' : 'View Full Memo'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>${isBn ? 'ভিউ' : 'View'}</span>
        </button>

        <button type="button" class="btn-card-edit" title="${isBn ? 'মেমো এডিট করুন' : 'Edit Memo'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>${isBn ? 'এডিট' : 'Edit'}</span>
        </button>

        <button type="button" class="btn-card-share" title="${isBn ? 'শেয়ার করুন' : 'Share'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>${isBn ? 'শেয়ার' : 'Share'}</span>
        </button>

        <button type="button" class="btn-card-delete" title="${isBn ? 'মুছে ফেলুন' : 'Delete'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>${isBn ? 'মুছুন' : 'Delete'}</span>
        </button>
      </div>
    `;

    // 1. View Button Click
    card.querySelector('.btn-card-view').addEventListener('click', () => {
      openViewMemoModal(memo);
    });

    // 2. Edit Button Click
    card.querySelector('.btn-card-edit').addEventListener('click', () => {
      reopenMemo(memo);
    });

    // 3. Share Button Click
    card.querySelector('.btn-card-share').addEventListener('click', () => {
      shareMemoCardData(memo);
    });

    // 4. Delete Button Click
    card.querySelector('.btn-card-delete').addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        TRANSLATIONS[state.lang].deleteConfirmTitle,
        `${TRANSLATIONS[state.lang].deleteConfirmMsg} (${memo.memoNo})`
      );
      if (confirmed) {
        deleteMemoFromHistory(memo.id);
      }
    });

    el.historyList.appendChild(card);
  });
}

function renderMemoPaperHtml(memoData) {
  const isBn = memoData.lang === 'en' ? false : true;
  const lang = memoData.lang || state.lang;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.bn;

  const memoDisplayNo = isBn ? toBanglaDigits(memoData.memoNo) : memoData.memoNo;
  const dateDisplay = formatDateDisplay(memoData.date, lang);
  const items = memoData.items || [];

  let subtotal = memoData.subtotal || 0;
  let discount = memoData.discount || 0;
  let grandTotal = memoData.grandTotal || 0;
  let paid = memoData.paid || 0;
  let due = memoData.due || 0;

  let rowsHtml = '';
  if (items.length === 0) {
    rowsHtml = `
      <tr>
        <td class="col-sl">—</td>
        <td style="color: #9ca3af; font-style: italic;">${isBn ? 'কোনো প্রোডাক্ট যোগ করা হয়নি' : 'No items'}</td>
        <td class="col-qty">—</td>
        <td class="col-price">—</td>
        <td class="col-total">—</td>
      </tr>
    `;
  } else {
    items.forEach((it, idx) => {
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.price) || 0;
      const total = q * p;
      const slText = isBn ? toBanglaDigits(idx + 1) : String(idx + 1);
      const qtyText = q > 0 ? (isBn ? toBanglaDigits(q) : String(q)) : '—';
      const priceText = p > 0 ? formatMoney(p, lang) : '—';
      const totalText = formatMoney(total, lang);

      rowsHtml += `
        <tr>
          <td class="col-sl">${slText}</td>
          <td><strong>${escapeHtml(it.name || '—')}</strong></td>
          <td class="col-qty">${qtyText}</td>
          <td class="col-price">${priceText}</td>
          <td class="col-total">${totalText}</td>
        </tr>
      `;
    });
  }

  const logoSrc = state.customLogo;
  const logoBoxHtml = logoSrc ? `<div class="memo-logo-box"><img src="${logoSrc}" alt="Logo" /></div>` : '';

  return `
    <div class="memo-paper-standalone" style="width: 800px; min-height: 1040px; background: #ffffff; color: #111827; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden; font-family: 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif;">
      <!-- Green Header Band -->
      <div class="memo-header-band" style="background-color: #0f7a4a; color: #ffffff; padding: 24px 32px; display: flex; align-items: center; gap: 20px;">
        ${logoBoxHtml}
        <div class="memo-brand-details">
          <div class="memo-business-name" style="font-size: 26px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Jononi Enterprise And Healthcare</div>
          <div class="memo-business-sub" style="font-size: 14px; color: rgba(255, 255, 255, 0.92);">Address: 27 Road, Tongi, Gazipur</div>
          <div class="memo-business-sub" style="font-size: 14px; color: rgba(255, 255, 255, 0.92);">Mobile: +880 1848-383410</div>
        </div>
      </div>

      <!-- Memo Body -->
      <div class="memo-body" style="padding: 24px 32px; flex: 1; display: flex; flex-direction: column;">
        <div class="memo-title-section" style="text-align: center; margin-bottom: 20px;">
          <div class="memo-title-text" style="font-size: 24px; font-weight: 700; color: #0f7a4a; display: inline-block;">${t.memoTitle}</div>
          <div class="memo-title-underline" style="width: 72px; height: 3px; background-color: #0f7a4a; margin: 6px auto 0; border-radius: 2px;"></div>
        </div>

        <!-- Two-column info box -->
        <div class="memo-info-box" style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; background: #fbfcfd; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
          <div class="memo-info-item" style="font-size: 15px;">
            <span class="memo-info-label" style="font-weight: 700; color: #4b5563;">${t.memoNoLabel}:</span>
            <span class="memo-info-val" style="font-weight: 600; color: #111827;">${memoDisplayNo}</span>
          </div>
          <div class="memo-info-item" style="font-size: 15px;">
            <span class="memo-info-label" style="font-weight: 700; color: #4b5563;">${t.dateLabel}:</span>
            <span class="memo-info-val" style="font-weight: 600; color: #111827;">${dateDisplay}</span>
          </div>
          <div class="memo-info-item" style="font-size: 15px;">
            <span class="memo-info-label" style="font-weight: 700; color: #4b5563;">${t.customerLabel}:</span>
            <span class="memo-info-val" style="font-weight: 600; color: #111827;">${escapeHtml(memoData.customerName || '—')}</span>
          </div>
          <div class="memo-info-item" style="font-size: 15px;">
            <span class="memo-info-label" style="font-weight: 700; color: #4b5563;">${t.mobileLabel}:</span>
            <span class="memo-info-val" style="font-weight: 600; color: #111827;">${memoData.customerMobile ? (isBn ? toBanglaDigits(memoData.customerMobile) : escapeHtml(memoData.customerMobile)) : '—'}</span>
          </div>
          <div class="memo-info-item" style="font-size: 15px; grid-column: 1 / -1;">
            <span class="memo-info-label" style="font-weight: 700; color: #4b5563;">ঠিকানা:</span>
            <span class="memo-info-val" style="font-weight: 600; color: #111827;">${escapeHtml(memoData.customerAddress || '—')}</span>
          </div>
        </div>

        <!-- Products Table -->
        <div class="memo-table-wrapper" style="margin-bottom: 20px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden;">
          <table class="memo-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #0f7a4a; color: #ffffff;">
                <th class="col-sl" style="padding: 10px 14px; width: 48px; text-align: center;">${t.slLabel}</th>
                <th style="padding: 10px 14px; text-align: left;">${t.productLabel}</th>
                <th class="col-qty" style="padding: 10px 14px; width: 70px; text-align: center;">${t.qtyLabel}</th>
                <th class="col-price" style="padding: 10px 14px; width: 110px; text-align: right;">${t.priceLabel}</th>
                <th class="col-total" style="padding: 10px 14px; width: 120px; text-align: right;">${t.totalLabel}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Totals & Signature Block -->
        <div class="memo-summary-area" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 20px; gap: 24px;">
          <div class="memo-signature-block" style="text-align: center; width: 200px;">
            <div class="memo-sig-line" style="border-top: 1px dashed #6b7280; margin-bottom: 6px;"></div>
            <div class="memo-sig-text" style="font-size: 13px; font-weight: 600; color: #4b5563;">${t.signatureLabel}</div>
          </div>

          <div class="memo-totals-block" style="width: 310px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #fbfcfd;">
            <div class="memo-total-row" style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
              <span>${t.subtotalLabel}</span>
              <span class="memo-total-val">${formatMoney(subtotal, lang)}</span>
            </div>
            ${discount > 0 ? `
            <div class="memo-total-row" style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
              <span>${t.discountLabel}</span>
              <span class="memo-total-val">${formatMoney(discount, lang)}</span>
            </div>` : ''}
            <div class="memo-total-row grand-total" style="display: flex; justify-content: space-between; padding: 10px 14px; font-size: 16px; font-weight: 700; background-color: #0f7a4a; color: #ffffff;">
              <span>${t.grandTotalLabel}</span>
              <span class="memo-total-val" style="color: #ffffff;">${formatMoney(grandTotal, lang)}</span>
            </div>
            ${paid > 0 ? `
            <div class="memo-total-row" style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
              <span>${t.paidLabel}</span>
              <span class="memo-total-val">${formatMoney(paid, lang)}</span>
            </div>` : ''}
            ${due > 0 ? `
            <div class="memo-total-row due-row" style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 14px; color: #dc2626; font-weight: 700; background-color: #fef2f2;">
              <span>${t.dueLabel}</span>
              <span class="memo-total-val">${formatMoney(due, lang)}</span>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Green Footer Band -->
      <div class="memo-footer-band" style="background-color: #0f7a4a; color: #ffffff; text-align: center; padding: 14px 20px; font-size: 15px; font-weight: 700;">
        ${t.footerText}
      </div>
    </div>
  `;
}

function openViewMemoModal(memo) {
  if (!el.viewMemoModal) return;
  currentViewingMemo = memo;
  if (el.viewMemoPaperContainer) {
    el.viewMemoPaperContainer.innerHTML = renderMemoPaperHtml(memo);
  }
  el.viewMemoModal.classList.add('active');
  fitViewMemoModalScale();
}

function closeViewMemoModal() {
  if (el.viewMemoModal) {
    el.viewMemoModal.classList.remove('active');
  }
}

function fitViewMemoModalScale() {
  if (!el.viewMemoScaler || !el.viewMemoPaperContainer) return;
  const parentWidth = el.viewMemoPaperContainer.parentElement ? el.viewMemoPaperContainer.parentElement.clientWidth - 32 : 760;
  const paperWidth = 800;
  let scale = Math.min(1, parentWidth / paperWidth);
  if (scale < 0.45) scale = 0.45;
  el.viewMemoScaler.style.transform = `scale(${scale})`;
}

function shareMemoCardData(memo) {
  const isBn = state.lang === 'bn';
  const text = `Jononi Pharmacy Cash Memo:\nMemo No: ${memo.memoNo}\nCustomer: ${memo.customerName || 'N/A'}\nTotal: ${formatMoney(memo.grandTotal, state.lang)}\nDue: ${formatMoney(memo.due || 0, state.lang)}`;

  if (navigator.share) {
    navigator.share({ title: `Memo ${memo.memoNo}`, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text);
    showToast(isBn ? 'মেমো তথ্য ক্লিপবোর্ডে কপি করা হয়েছে।' : 'Memo details copied to clipboard.', 'success');
  }
}

// --- PRODUCTS MANAGEMENT LOGIC ---
const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Napa Extra 500mg', category: 'Paracetamol / Tablet', price: 2.50, unit: 'Pcs' },
  { id: 'p2', name: 'Seclo 20mg', category: 'PPI / Capsule', price: 5.00, unit: 'Pcs' },
  { id: 'p3', name: 'Ace 500mg', category: 'Paracetamol / Tablet', price: 1.50, unit: 'Pcs' },
  { id: 'p4', name: 'Fexo 120mg', category: 'Antihistamine / Tablet', price: 6.00, unit: 'Pcs' },
  { id: 'p5', name: 'Monas 10mg', category: 'Anti-asthmatic / Tablet', price: 10.00, unit: 'Pcs' },
  { id: 'p6', name: 'Maxpro 20mg', category: 'PPI / Capsule', price: 6.50, unit: 'Pcs' }
];

function getSavedProducts() {
  if (cloudProducts.length > 0) {
    return cloudProducts;
  }
  return DEFAULT_PRODUCTS;
}

function saveProductsList(products) {
  cloudProducts = products;
}


function updateProductsTab() {
  const products = getSavedProducts();
  if (el.productsBadgeCount) {
    el.productsBadgeCount.textContent = state.lang === 'bn' ? toBanglaDigits(products.length) : products.length;
  }
  renderProductsList(products);
  updateProductDatalist();
}

function updateProductDatalist() {
  const datalist = document.getElementById('saved-products-datalist');
  if (!datalist) return;
  const products = getSavedProducts();
  datalist.innerHTML = '';
  products.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.name;
    const cat = p.category ? ` (${p.category})` : '';
    const price = p.price !== undefined ? ` - ৳${p.price}` : '';
    opt.label = `${p.name}${cat}${price}`;
    datalist.appendChild(opt);
  });
}

function openCatalogPickerModal() {
  if (!el.catalogPickerModal) return;
  if (el.catalogPickerSearch) el.catalogPickerSearch.value = '';
  renderCatalogPickerItems();
  el.catalogPickerModal.classList.add('active');
}

function closeCatalogPickerModal() {
  if (el.catalogPickerModal) {
    el.catalogPickerModal.classList.remove('active');
  }
}

function renderCatalogPickerItems() {
  if (!el.catalogPickerList) return;
  const query = el.catalogPickerSearch ? el.catalogPickerSearch.value.trim().toLowerCase() : '';
  const products = getSavedProducts();
  const isBn = state.lang === 'bn';

  const filtered = products.filter((p) => {
    if (!query) return true;
    const name = (p.name || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return name.includes(query) || cat.includes(query);
  });

  if (el.catalogPickerCount) {
    el.catalogPickerCount.textContent = isBn
      ? `মোট ${toBanglaDigits(filtered.length)}টি প্রোডাক্ট পাওয়া গেছে`
      : `Found ${filtered.length} products`;
  }

  el.catalogPickerList.innerHTML = '';

  if (filtered.length === 0) {
    el.catalogPickerList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">
        ${isBn ? 'কোনো সেভ করা প্রোডাক্ট পাওয়া যায়নি।' : 'No saved products found.'}
      </div>
    `;
    return;
  }

  filtered.forEach((prod) => {
    const card = document.createElement('div');
    card.className = 'catalog-product-card';
    card.style.cursor = 'pointer';
    const priceDisplay = formatMoney(prod.price, state.lang);

    card.innerHTML = `
      <div>
        <div class="catalog-product-name">${escapeHtml(prod.name)}</div>
        <div class="catalog-product-cat">${escapeHtml(prod.category || '—')} • ${escapeHtml(prod.unit || 'Pcs')}</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem;">
        <span class="catalog-product-price">${priceDisplay}</span>
        <button type="button" class="btn btn-outline btn-sm btn-pick-item" style="border-color: var(--primary); color: var(--primary); font-weight: 700;">
          ＋ ${isBn ? 'যোগ করুন' : 'Add'}
        </button>
      </div>
    `;

    const handleAdd = (e) => {
      e.stopPropagation();
      addCatalogProductToMemo(prod);
    };

    card.querySelector('.btn-pick-item').addEventListener('click', handleAdd);
    card.addEventListener('click', handleAdd);

    el.catalogPickerList.appendChild(card);
  });
}

function addCatalogProductToMemo(prod) {
  let targetItem = state.items.find((it) => !it.name || it.name.trim() === '');
  if (targetItem) {
    targetItem.name = prod.name;
    targetItem.price = prod.price !== undefined ? String(prod.price) : '0';
    targetItem.qty = '1';
  } else {
    const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    state.items.push({
      id: newId,
      name: prod.name,
      price: prod.price !== undefined ? String(prod.price) : '0',
      qty: '1'
    });
  }

  renderFormItems();
  updateLivePreview();
  showToast(`"${prod.name}" মেমোতে যোগ করা হয়েছে!`, 'success');
}

// State for Products Management Filtering & Viewing
let currentProductCategoryFilter = 'all';
let currentViewingProduct = null;

function getCategoryBadgeClass(category = '') {
  const cat = (category || '').toLowerCase();
  if (cat.includes('tab') || cat.includes('ট্যাবলেট')) {
    return 'badge-cat-tablet';
  } else if (cat.includes('cap') || cat.includes('ক্যাপসুল')) {
    return 'badge-cat-capsule';
  } else if (cat.includes('syr') || cat.includes('সিরাপ') || cat.includes('susp') || cat.includes('ড্রপ')) {
    return 'badge-cat-syrup';
  }
  return 'badge-cat-other';
}

function setProductCategoryFilter(cat) {
  currentProductCategoryFilter = cat;
  if (el.productFilterBtns) {
    el.productFilterBtns.forEach((btn) => {
      if (btn.getAttribute('data-cat') === cat) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  renderProductsList(getSavedProducts());
}

function renderProductsList(products) {
  const query = el.productSearchInput ? el.productSearchInput.value.trim().toLowerCase() : '';
  if (!el.productsTbody) return;
  el.productsTbody.innerHTML = '';
  const isBn = state.lang === 'bn';

  const filtered = products.filter((p) => {
    const name = (p.name || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();

    // Category Pill Filter
    if (currentProductCategoryFilter === 'tablet') {
      if (!cat.includes('tab') && !cat.includes('ট্যাবলেট') && !name.includes('tab')) return false;
    } else if (currentProductCategoryFilter === 'capsule') {
      if (!cat.includes('cap') && !cat.includes('ক্যাপসুল') && !name.includes('cap')) return false;
    } else if (currentProductCategoryFilter === 'syrup') {
      if (!cat.includes('syr') && !cat.includes('সিরাপ') && !cat.includes('susp') && !cat.includes('ড্রপ')) return false;
    }

    if (!query) return true;
    return name.includes(query) || cat.includes(query);
  });

  if (el.productCountSummary) {
    el.productCountSummary.textContent = isBn 
      ? `মোট প্রোডাক্ট: ${toBanglaDigits(filtered.length)}` 
      : `Total Products: ${filtered.length}`;
  }

  if (filtered.length === 0) {
    el.productsTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          ${isBn ? 'কোনো প্রোডাক্ট পাওয়া যায়নি।' : 'No products found.'}
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((prod, index) => {
    const tr = document.createElement('tr');
    const priceDisplay = formatMoney(prod.price, state.lang);
    const slDisplay = isBn ? toBanglaDigits(index + 1) : String(index + 1);
    const catClass = getCategoryBadgeClass(prod.category);

    tr.innerHTML = `
      <td style="font-weight: 700; text-align: center; color: var(--text-muted);">${slDisplay}</td>
      <td>
        <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(prod.name)}</div>
      </td>
      <td>
        <span class="badge-cat ${catClass}">
          ${escapeHtml(prod.category || (isBn ? 'সাধারণ' : 'General'))}
        </span>
      </td>
      <td style="text-align: right;">
        <span class="prod-price-pill">${priceDisplay}</span>
      </td>
      <td style="text-align: center;">
        <span class="prod-unit-pill">${escapeHtml(prod.unit || 'Pcs')}</span>
      </td>
      <td style="text-align: center;">
        <div class="prod-action-group">
          <!-- 1. View Button (কালার গ্র্যাডিং সহ ভিউ বাটন) -->
          <button type="button" class="btn-prod-view-action" title="${isBn ? 'প্রোডাক্ট বিস্তারিত দেখুন' : 'View Product Details'}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>${isBn ? 'ভিউ' : 'View'}</span>
          </button>

          <!-- 2. Add To Memo Button -->
          <button type="button" class="btn-prod-add-action" title="${isBn ? 'মেমোতে যোগ করুন' : 'Add to Memo'}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>${isBn ? 'যোগ' : 'Add'}</span>
          </button>

          <!-- 3. Edit Button -->
          <button type="button" class="btn-prod-edit-action" title="${isBn ? 'এডিট করুন' : 'Edit'}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>

          <!-- 4. Delete Button -->
          <button type="button" class="btn-prod-del-action" title="${isBn ? 'মুছে ফেলুন' : 'Delete'}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    `;

    // 1. View Button Click
    tr.querySelector('.btn-prod-view-action').addEventListener('click', () => {
      openViewProductModal(prod);
    });

    // 2. Add To Memo Click
    tr.querySelector('.btn-prod-add-action').addEventListener('click', () => {
      addCatalogProductToMemo(prod);
    });

    // 3. Edit Button Click
    tr.querySelector('.btn-prod-edit-action').addEventListener('click', () => {
      openProductModal(prod);
    });

    // 4. Delete Button Click
    tr.querySelector('.btn-prod-del-action').addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        isBn ? 'প্রোডাক্ট মুছে ফেলবেন?' : 'Delete Product?',
        isBn ? `"${prod.name}" প্রোডাক্টটি তালিকা থেকে মুছে ফেলা হবে। আপনি কি নিশ্চিত?` : `Are you sure you want to delete "${prod.name}"?`
      );
      if (confirmed) {
        deleteProduct(prod.id);
      }
    });

    el.productsTbody.appendChild(tr);
  });
}

function openViewProductModal(prod) {
  if (!el.viewProductModal || !prod) return;
  currentViewingProduct = prod;

  if (el.viewProdName) el.viewProdName.textContent = prod.name;
  if (el.viewProdPrice) el.viewProdPrice.textContent = formatMoney(prod.price, state.lang);
  if (el.viewProdUnit) el.viewProdUnit.textContent = prod.unit || 'Pcs';
  if (el.viewProdCategoryText) el.viewProdCategoryText.textContent = prod.category || (state.lang === 'bn' ? 'সাধারণ / ক্যাটালগ আইটেম' : 'General Catalog Item');
  if (el.viewProdId) el.viewProdId.textContent = prod.id || ('PROD-' + Date.now().toString(36).toUpperCase());

  if (el.viewProdCategoryBadge) {
    el.viewProdCategoryBadge.textContent = prod.category || (state.lang === 'bn' ? 'সাধারণ' : 'General');
    const catClass = getCategoryBadgeClass(prod.category);
    el.viewProdCategoryBadge.className = `badge-cat ${catClass}`;
  }

  el.viewProductModal.classList.add('active');
}

function closeViewProductModal() {
  if (el.viewProductModal) {
    el.viewProductModal.classList.remove('active');
  }
}

function openProductModal(product = null) {
  if (!el.productModal) return;
  if (product) {
    if (el.productModalTitle) el.productModalTitle.textContent = state.lang === 'bn' ? 'প্রোডাক্ট এডিট করুন' : 'Edit Product';
    if (el.productEditId) el.productEditId.value = product.id;
    if (el.modalProdName) el.modalProdName.value = product.name || '';
    if (el.modalProdCategory) el.modalProdCategory.value = product.category || '';
    if (el.modalProdPrice) el.modalProdPrice.value = product.price !== undefined ? product.price : '';
    if (el.modalProdUnit) el.modalProdUnit.value = product.unit || 'Pcs';
  } else {
    if (el.productModalTitle) el.productModalTitle.textContent = state.lang === 'bn' ? 'নতুন প্রোডাক্ট যোগ করুন' : 'Add New Product';
    if (el.productEditId) el.productEditId.value = '';
    if (el.productForm) el.productForm.reset();
    if (el.modalProdUnit) el.modalProdUnit.value = 'Pcs';
  }
  el.productModal.classList.add('active');
}

function closeProductModal() {
  if (el.productModal) {
    el.productModal.classList.remove('active');
  }
}

async function saveProductFromModal(e) {
  e.preventDefault();
  if (!auth.currentUser) {
    showToast('ক্লাউড ডেটাবেজে প্রোডাক্ট সেভ করতে অনুগ্রহ করে প্রথমে সাইন-ইন করুন।', 'danger');
    try {
      await loginWithGoogle();
    } catch {
      return;
    }
  }

  const id = el.productEditId && el.productEditId.value ? el.productEditId.value : ('prod_' + Date.now());
  const name = el.modalProdName ? el.modalProdName.value.trim() : '';
  const category = el.modalProdCategory ? el.modalProdCategory.value.trim() : '';
  const price = parseFloat(el.modalProdPrice ? el.modalProdPrice.value : 0) || 0;
  const unit = el.modalProdUnit ? el.modalProdUnit.value.trim() || 'Pcs' : 'Pcs';

  if (!name) {
    showToast('প্রোডাক্টের নাম আবশ্যক।', 'danger');
    return;
  }

  try {
    await saveProductToCloud({ id, name, category, unitPrice: price, price, unit });
    closeProductModal();
    showToast('প্রোডাক্ট সফলভাবে গুগল ফায়ারবেস ক্লাউডে সংরক্ষিত হয়েছে!', 'success');
  } catch (err) {
    console.error('Firebase product save error:', err);
    showToast('ফায়ারবেসে প্রোডাক্ট সেভ করতে সমস্যা হয়েছে।', 'danger');
  }
}

async function deleteProduct(id) {
  if (!auth.currentUser) {
    showToast('লগইন প্রয়োজন।', 'danger');
    return;
  }
  try {
    await deleteProductFromCloud(id);
    showToast('প্রোডাক্ট গুগল ক্লাউড থেকে সফলভাবে মুছে ফেলা হয়েছে।', 'success');
  } catch (err) {
    console.error('Delete product error:', err);
    showToast('প্রোডাক্ট মুছতে সমস্যা হয়েছে।', 'danger');
  }
}

// --- BACKUP & RESTORE LOGIC ---
function handleBackupJson() {
  const history = getSavedHistory();
  const counters = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_KEYS.COUNTER_PREFIX)) {
        counters[k] = localStorage.getItem(k);
      }
    }
  } catch (e) {
    console.warn('Storage key read warning:', e);
  }

  const backupData = {
    app: 'Jononi Pharmacy',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    logo: state.customLogo,
    history,
    counters,
    settings: {
      lang: state.lang,
      theme: state.theme
    }
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `jononi-pharmacy-backup-${getTodayDateString()}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);

  showToast('ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে!', 'success');
}

async function handleRestoreJson(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.history)) {
        showToast('ভুল ফরম্যাট! এটি সঠিক ব্যাকআপ ফাইল নয়।', 'danger');
        return;
      }

      const confirmed = await showConfirmDialog(
        TRANSLATIONS[state.lang].restoreConfirmTitle,
        TRANSLATIONS[state.lang].restoreConfirmMsg
      );

      if (!confirmed) return;

      // Restore History
      Storage.set(STORAGE_KEYS.HISTORY, data.history);

      // Restore Counters
      if (data.counters && typeof data.counters === 'object') {
        Object.keys(data.counters).forEach((k) => {
          Storage.set(k, data.counters[k]);
        });
      }

      // Restore Logo
      if (data.logo) {
        state.customLogo = data.logo;
        Storage.set(STORAGE_KEYS.CUSTOM_LOGO, data.logo);
      }

      // Restore Settings
      if (data.settings) {
        if (data.settings.lang) state.lang = data.settings.lang;
        if (data.settings.theme) applyTheme(data.settings.theme);
      }

      updateLogoDisplays();
      setLanguage(state.lang);
      updateHistoryTab();
      resetForm(true);

      showToast(TRANSLATIONS[state.lang].restoreSuccess, 'success');
    } catch (err) {
      console.error('Restore error:', err);
      showToast('ব্যাকআপ ফাইল পড়তে ত্রুটি হয়েছে।', 'danger');
    }
  };
  reader.readAsText(file);
}

// --- SIDEBAR MANAGEMENT ---
function closeMobileSidebar() {
  if (el.appShell) {
    el.appShell.classList.remove('sidebar-mobile-open');
  }
}

function toggleSidebar() {
  if (!el.appShell) return;
  const isMobile = window.innerWidth < 1024;
  if (isMobile) {
    el.appShell.classList.toggle('sidebar-mobile-open');
  } else {
    el.appShell.classList.toggle('sidebar-collapsed');
    const isCollapsed = el.appShell.classList.contains('sidebar-collapsed');
    Storage.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isCollapsed));
  }
}

function initSidebar() {
  const isStoredCollapsed = Storage.get(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  if (isStoredCollapsed && window.innerWidth >= 1024 && el.appShell) {
    el.appShell.classList.add('sidebar-collapsed');
  }

  if (el.btnSidebarToggle) {
    el.btnSidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  if (el.btnSidebarCollapse) {
    el.btnSidebarCollapse.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  if (el.sidebarBackdrop) {
    el.sidebarBackdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  // Sidebar navigation items
  if (el.sidebarNavItems) {
    el.sidebarNavItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        if (tabId) {
          switchTab(tabId);
          closeMobileSidebar();
        }
      });
    });
  }
}

// --- PROFILE TAB LOGIC ---
const DEFAULT_PROFILE = {
  shopName: 'Jononi Enterprise And Healthcare',
  pharmacistName: 'মো: হাবিবুর রহমান (Pharmacist)',
  dlNo: 'GAZI-DH/18429',
  tradeNo: 'TRAD/GZP/04821',
  phone: '+880 1848-383410',
  address: 'Address: 27 Road, Tongi, Gazipur',
  hours: 'সকাল ৮:০০ - রাত ১১:৩০ (প্রতিদিন)'
};

function loadProfileTab() {
  const profile = Storage.getJSON(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
  if (el.profilePharmacistName) el.profilePharmacistName.value = profile.pharmacistName || '';
  if (el.profileDlNo) el.profileDlNo.value = profile.dlNo || '';
  if (el.profileTradeNo) el.profileTradeNo.value = profile.tradeNo || '';
  if (el.profileHours) el.profileHours.value = profile.hours || '';
}

function saveProfileTab() {
  const profile = {
    shopName: 'Jononi Enterprise And Healthcare',
    pharmacistName: el.profilePharmacistName ? el.profilePharmacistName.value.trim() : '',
    dlNo: el.profileDlNo ? el.profileDlNo.value.trim() : '',
    tradeNo: el.profileTradeNo ? el.profileTradeNo.value.trim() : '',
    phone: '+880 1848-383410',
    address: 'Address: 27 Road, Tongi, Gazipur',
    hours: el.profileHours ? el.profileHours.value.trim() : ''
  };

  Storage.set(STORAGE_KEYS.PROFILE, profile);
  if (el.profileSaveHint) {
    el.profileSaveHint.style.display = 'inline';
    setTimeout(() => {
      if (el.profileSaveHint) el.profileSaveHint.style.display = 'none';
    }, 3000);
  }
  showToast('ফার্মেসি প্রোফাইল তথ্য সফলভাবে সংরক্ষিত হয়েছে!', 'success');
}

// --- REPORT TAB LOGIC ---
let currentReportRange = 'today';

function setReportRange(range) {
  currentReportRange = range;
  if (el.reportFilterBtns) {
    el.reportFilterBtns.forEach((btn) => {
      if (btn.getAttribute('data-range') === range) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  updateReportTab();
}

function filterMemosByRange(memos, range) {
  const todayStr = getTodayDateString();
  const now = new Date();

  return memos.filter((m) => {
    if (!m.date) return false;
    if (range === 'all') return true;
    if (range === 'today') return m.date === todayStr;

    const memoDate = new Date(m.date + 'T00:00:00');
    if (isNaN(memoDate.getTime())) return false;

    if (range === 'week') {
      const diffDays = (now - memoDate) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }

    if (range === 'month') {
      const memoYearMonth = m.date.slice(0, 7);
      const currentYearMonth = todayStr.slice(0, 7);
      return memoYearMonth === currentYearMonth;
    }

    return true;
  });
}

function handleReportCustomerSearch() {
  if (!el.reportCustomerSearch || !el.reportCustomerResults) return;
  const query = el.reportCustomerSearch.value.trim().toLowerCase();
  const history = getSavedHistory();
  const isBn = state.lang === 'bn';

  if (!query) {
    el.reportCustomerResults.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;">
        ${isBn ? 'কোনো গ্রাহক খুঁজতে নাম বা মোবাইল নম্বর টাইপ করুন।' : 'Type customer name or mobile to search history.'}
      </div>
    `;
    return;
  }

  const queryDigits = extractMobileDigits(query);

  const matchedMemos = history.filter((m) => {
    const custName = (m.customerName || '').toLowerCase();
    const custMobileDigits = extractMobileDigits(m.customerMobile || '');
    const custMobileRaw = (m.customerMobile || '').toLowerCase();
    const custAddress = (m.customerAddress || '').toLowerCase();

    const nameMatch = custName.includes(query) || custAddress.includes(query);
    const mobileMatch = queryDigits.length > 0 && custMobileDigits.includes(queryDigits);
    const rawMobileMatch = custMobileRaw.includes(query);

    return nameMatch || mobileMatch || rawMobileMatch;
  });

  if (matchedMemos.length === 0) {
    el.reportCustomerResults.innerHTML = `
      <div style="text-align: center; color: var(--danger); font-size: 0.9rem; padding: 1.25rem; font-weight: 600;">
        ${isBn ? `"${escapeHtml(query)}" নামে বা নম্বরে কোনো ক্রয়ের ইতিহাস পাওয়া যায়নি।` : `No purchase history found for "${escapeHtml(query)}".`}
      </div>
    `;
    return;
  }

  el.reportCustomerResults.innerHTML = '';
  matchedMemos.forEach((memo) => {
    const dueVal = parseFloat(memo.due) || 0;
    const isPaid = dueVal <= 0;
    const statusHtml = isPaid
      ? `<span class="status-pill paid">${isBn ? 'পরিশোধিত' : 'Paid'}</span>`
      : `<span class="status-pill due">${isBn ? `বাকি ${formatMoney(dueVal, state.lang)}` : `Due ${formatMoney(dueVal, state.lang)}`}</span>`;

    const div = document.createElement('div');
    div.className = 'history-item';
    div.style.background = 'var(--bg-card)';
    div.style.padding = '0.85rem 1rem';
    div.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-top">
          <span class="history-memo-no">মেমো নং: ${escapeHtml(memo.memoNo)}</span>
          <span class="history-badge">${formatDateDisplay(memo.date, state.lang)}</span>
          ${statusHtml}
        </div>
        <div class="history-item-details">
          <strong>গ্রাহক:</strong> ${escapeHtml(memo.customerName || 'নামবিহীন')} | <strong>মোবাইল:</strong> ${escapeHtml(memo.customerMobile || 'নেই')}
          ${memo.customerAddress ? `<br><strong>ঠিকানা:</strong> ${escapeHtml(memo.customerAddress)}` : ''}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="history-item-amount">${formatMoney(memo.grandTotal, state.lang)}</div>
        <button type="button" class="btn btn-outline btn-sm btn-reopen-customer-memo" title="${isBn ? 'মেমো খুলুন' : 'Open Memo'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>
      </div>
    `;

    div.querySelector('.btn-reopen-customer-memo').addEventListener('click', () => {
      reopenMemo(memo);
    });

    el.reportCustomerResults.appendChild(div);
  });
}

function updateReportTab() {
  const allMemos = getSavedHistory();
  const filtered = filterMemosByRange(allMemos, currentReportRange);
  const isBn = state.lang === 'bn';

  let totalSales = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let totalDiscount = 0;
  const productMap = {};

  filtered.forEach((memo) => {
    totalSales += parseFloat(memo.grandTotal) || 0;
    totalPaid += parseFloat(memo.paid) || 0;
    totalDue += parseFloat(memo.due) || 0;
    totalDiscount += parseFloat(memo.discount) || 0;

    if (Array.isArray(memo.items)) {
      memo.items.forEach((item) => {
        const name = (item.name || '').trim();
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        if (name && qty > 0) {
          if (!productMap[name]) {
            productMap[name] = { qty: 0, sales: 0 };
          }
          productMap[name].qty += qty;
          productMap[name].sales += qty * price;
        }
      });
    }
  });

  // Render Metric Cards
  if (el.rptTotalMemos) {
    el.rptTotalMemos.textContent = isBn ? toBanglaDigits(filtered.length) : String(filtered.length);
  }
  if (el.rptTotalSales) {
    el.rptTotalSales.textContent = formatMoney(totalSales, state.lang);
  }
  if (el.rptTotalPaid) {
    el.rptTotalPaid.textContent = formatMoney(totalPaid, state.lang);
  }
  if (el.rptTotalDue) {
    el.rptTotalDue.textContent = formatMoney(totalDue, state.lang);
  }
  if (el.rptTotalDiscount) {
    el.rptTotalDiscount.textContent = formatMoney(totalDiscount, state.lang);
  }

  // Render Top Products Table
  if (el.rptTopProductsTbody) {
    el.rptTopProductsTbody.innerHTML = '';
    const sortedProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    if (sortedProducts.length === 0) {
      el.rptTopProductsTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">📦</div>
            <div>${isBn ? 'এই সময়ের মধ্যে কোনো প্রোডাক্ট বিক্রির তথ্য পাওয়া যায়নি।' : 'No product sales recorded in this period.'}</div>
          </td>
        </tr>
      `;
    } else {
      const maxQty = Math.max(...sortedProducts.map((p) => p.qty), 1);
      sortedProducts.forEach((prod, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        const rankLabel = isBn ? toBanglaDigits(rank) : String(rank);
        const medalEmoji = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
        const percent = Math.min(100, Math.max(12, Math.round((prod.qty / maxQty) * 100)));
        const qtyDisplay = isBn ? toBanglaDigits(prod.qty) : String(prod.qty);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="text-align: center;">
            <span class="rank-badge ${rankClass}" title="${isBn ? 'র‍্যাংক' : 'Rank'} #${rank}">${rankLabel}</span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.3rem;">
                ${medalEmoji}<span>${escapeHtml(prod.name)}</span>
              </div>
              <div class="prod-sales-progress" title="${isBn ? 'মোট বিক্রয়ের অনুপাত' : 'Sales share'}">
                <div class="prod-sales-bar" style="width: ${percent}%;"></div>
              </div>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="report-qty-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="11 3 11 11 14 8 17 11 17 3"></polyline></svg>
              <span>${qtyDisplay} টি</span>
            </span>
          </td>
          <td style="text-align: right;">
            <span class="report-revenue-text">${formatMoney(prod.sales, state.lang)}</span>
          </td>
          <td style="text-align: center;">
            <div class="report-action-group">
              <button type="button" class="report-action-btn view btn-prod-view" title="${isBn ? 'বিস্তারিত দেখুন' : 'View Summary'}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button type="button" class="report-action-btn edit btn-prod-edit" title="${isBn ? 'প্রোডাক্ট তথ্য এডিট' : 'Edit Product'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button type="button" class="report-action-btn delete btn-prod-delete" title="${isBn ? 'তালিকা থেকে মুছুন' : 'Delete'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
              <button type="button" class="report-action-btn share btn-prod-share" title="${isBn ? 'শেয়ার বা কপি' : 'Share'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-prod-view').addEventListener('click', () => {
          showToast(`প্রোডাক্ট: ${prod.name} | মোট বিক্রিত: ${prod.qty} টি | মূল্য: ${formatMoney(prod.sales, state.lang)}`, 'success');
        });

        tr.querySelector('.btn-prod-edit').addEventListener('click', () => {
          switchTab('tab-products');
          const products = getSavedProducts();
          const match = products.find((p) => p.name.toLowerCase() === prod.name.toLowerCase());
          if (match) {
            openProductModal(match);
          } else {
            openProductModal({ id: '', name: prod.name, category: 'Top Selling', price: prod.sales / (prod.qty || 1), unit: 'Pcs' });
          }
        });

        tr.querySelector('.btn-prod-delete').addEventListener('click', async () => {
          const confirmed = await showConfirmDialog(
            isBn ? 'প্রোডাক্ট বিক্রয় তালিকা থেকে সরিয়ে ফেলবেন?' : 'Remove Product from Sales Report?',
            isBn ? `"${prod.name}" প্রোডাক্টটি তালিকা থেকে মুছে ফেলা হবে।` : `Remove "${prod.name}" from sales record?`
          );
          if (confirmed) {
            let products = getSavedProducts();
            products = products.filter((p) => p.name.toLowerCase() !== prod.name.toLowerCase());
            saveProductsList(products);
            updateProductsTab();
            updateReportTab();
            showToast(isBn ? 'প্রোডাক্ট সফলভাবে মুছে ফেলা হয়েছে।' : 'Product deleted successfully.', 'success');
          }
        });

        tr.querySelector('.btn-prod-share').addEventListener('click', async () => {
          const shareText = `Jononi Pharmacy Product Sales:\nProduct: ${prod.name}\nQuantity Sold: ${prod.qty}\nTotal Sales: ${formatMoney(prod.sales, state.lang)}`;
          if (navigator.share) {
            try {
              await navigator.share({ title: prod.name, text: shareText });
            } catch {
              // fallback
            }
          } else {
            navigator.clipboard.writeText(shareText);
            showToast(isBn ? 'প্রোডাক্টের তথ্য ক্লিপবোর্ডে কপি করা হয়েছে।' : 'Product info copied to clipboard.', 'success');
          }
        });

        el.rptTopProductsTbody.appendChild(tr);
      });
    }
  }

  // Render Recent Memos Table
  if (el.rptRecentMemosTbody) {
    el.rptRecentMemosTbody.innerHTML = '';
    const displayMemos = filtered.slice(0, 15);

    const countPill = document.getElementById('rpt-memos-count-pill');
    if (countPill) {
      countPill.textContent = isBn ? `সর্বশেষ ${toBanglaDigits(displayMemos.length)} টি` : `Latest ${displayMemos.length}`;
    }

    if (displayMemos.length === 0) {
      el.rptRecentMemosTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">📄</div>
            <div>${isBn ? 'নির্বাচিত সময়ে কোনো মেমো পাওয়া যায়নি।' : 'No memos found in this period.'}</div>
          </td>
        </tr>
      `;
    } else {
      displayMemos.forEach((memo) => {
        const dueVal = parseFloat(memo.due) || 0;
        const isPaid = dueVal <= 0;
        const itemsCount = Array.isArray(memo.items) ? memo.items.length : 0;
        const itemsText = isBn ? `${toBanglaDigits(itemsCount)} টি` : `${itemsCount} items`;

        const statusHtml = isPaid
          ? `<span class="status-pill paid" style="font-weight: 700;"><span style="color:#059669; font-size: 1.1em;">●</span> ${isBn ? 'পরিশোধিত' : 'Paid'}</span>`
          : `<span class="status-pill due" style="font-weight: 700;"><span style="color:#dc2626; font-size: 1.1em;">●</span> ${isBn ? `বাকি ${formatMoney(dueVal, state.lang)}` : `Due ${formatMoney(dueVal, state.lang)}`}</span>`;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = isBn ? 'মেমো দেখতে ক্লিক করুন' : 'Click to view memo';
        tr.innerHTML = `
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="memo-no-tag">#${escapeHtml(memo.memoNo || '—')}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${formatDateDisplay(memo.date, state.lang)}</span>
              </span>
            </div>
          </td>
          <td>
            <div class="customer-cell-main">
              👤 ${escapeHtml(memo.customerName || (isBn ? 'নামবিহীন গ্রাহক' : 'Anonymous'))}
            </div>
            <div class="customer-cell-sub">
              📞 ${escapeHtml(memo.customerMobile ? (isBn ? toBanglaDigits(memo.customerMobile) : memo.customerMobile) : (isBn ? 'মোবাইল নেই' : 'No mobile'))}
            </div>
          </td>
          <td style="text-align: center;">
            <span style="font-size: 0.82rem; font-weight: 700; padding: 0.2rem 0.55rem; background: var(--bg-page); border: 1px solid var(--border); border-radius: 12px; color: var(--text-muted);">
              ${itemsText}
            </span>
          </td>
          <td style="text-align: right; font-weight: 800; font-size: 0.96rem; color: var(--text-main);">
            ${formatMoney(memo.grandTotal, state.lang)}
          </td>
          <td style="text-align: center;">
            ${statusHtml}
          </td>
          <td style="text-align: center;">
            <button type="button" class="report-view-memo-btn btn-view-memo" title="${isBn ? 'মেমো ভিউ ও প্রিন্ট' : 'View Memo'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>${isBn ? 'মেমো' : 'View'}</span>
            </button>
          </td>
        `;

        tr.querySelector('.btn-view-memo').addEventListener('click', (e) => {
          e.stopPropagation();
          openViewMemoModal(memo);
        });

        tr.addEventListener('click', () => {
          openViewMemoModal(memo);
        });

        el.rptRecentMemosTbody.appendChild(tr);
      });
    }
  }
}

// --- BACKUP TAB LOGIC ---
function updateBackupTab() {
  const history = getSavedHistory();
  const isBn = state.lang === 'bn';

  if (el.backupTotalMemos) {
    el.backupTotalMemos.textContent = isBn
      ? `${toBanglaDigits(history.length)} টি`
      : `${history.length} memos`;
  }

  if (el.backupStorageSize) {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          totalBytes += (localStorage.getItem(k) || '').length * 2;
        }
      }
      const kb = (totalBytes / 1024).toFixed(1);
      el.backupStorageSize.textContent = isBn ? `~${toBanglaDigits(kb)} KB` : `~${kb} KB`;
    } catch {
      el.backupStorageSize.textContent = '~৫ KB';
    }
  }
}

// --- HOME DASHBOARD LOGIC ---
function updateHomeDashboard() {
  const history = getSavedHistory();
  const products = getSavedProducts();
  const isBn = state.lang === 'bn';

  let totalSales = 0;
  history.forEach(m => {
    totalSales += parseFloat(m.grandTotal) || 0;
  });

  if (el.homeStatMemos) {
    el.homeStatMemos.textContent = isBn ? toBanglaDigits(history.length) : String(history.length);
  }
  if (el.homeStatSales) {
    el.homeStatSales.textContent = formatMoney(totalSales, state.lang);
  }
  if (el.homeStatProducts) {
    el.homeStatProducts.textContent = isBn ? toBanglaDigits(products.length) : String(products.length);
  }
}

// --- TAB SWITCHING ---
function switchTab(targetTabId) {
  // Update sidebar active buttons
  if (el.sidebarNavItems) {
    el.sidebarNavItems.forEach((btn) => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Update tab panes
  if (el.tabPanes) {
    el.tabPanes.forEach((pane) => {
      if (pane.id === targetTabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  // Trigger tab-specific refresh
  if (targetTabId === 'tab-home') {
    updateHomeDashboard();
  } else if (targetTabId === 'tab-editor') {
    setTimeout(fitPreviewScale, 50);
  } else if (targetTabId === 'tab-history') {
    updateHistoryTab();
  } else if (targetTabId === 'tab-products') {
    updateProductsTab();
  } else if (targetTabId === 'tab-profile') {
    loadProfileTab();
  } else if (targetTabId === 'tab-report') {
    updateReportTab();
  } else if (targetTabId === 'tab-settings') {
    updateBackupTab();
  }
}

// --- PWA & SERVICE WORKER SETUP ---
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    });
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    if (el.pwaInstallBtn) el.pwaInstallBtn.style.display = 'none';
    if (el.appinfoInstallBtn) {
      el.appinfoInstallBtn.innerHTML = '<span>✓ হোম স্ক্রিনে ইনস্টল করা আছে</span>';
      el.appinfoInstallBtn.classList.remove('btn-outline');
      el.appinfoInstallBtn.classList.add('btn-secondary');
      el.appinfoInstallBtn.disabled = true;
    }
  } else if (isIOS) {
    if (el.pwaInstallBtn) el.pwaInstallBtn.style.display = 'inline-flex';
    if (el.pwaInstallBtn) {
      el.pwaInstallBtn.addEventListener('click', () => {
        el.iosGuideModal.classList.add('active');
      });
    }
    if (el.appinfoInstallBtn) {
      el.appinfoInstallBtn.addEventListener('click', () => {
        el.iosGuideModal.classList.add('active');
      });
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    if (el.pwaInstallBtn) el.pwaInstallBtn.style.display = 'inline-flex';
    if (el.pwaBtnLabel) el.pwaBtnLabel.textContent = state.lang === 'bn' ? 'ইনস্টল' : 'Install';
  });

  const handleInstallClick = async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        if (el.pwaInstallBtn) el.pwaInstallBtn.style.display = 'none';
        showToast('অ্যাপটি হোম স্ক্রিনে যোগ করা হয়েছে!', 'success');
      }
      state.deferredPrompt = null;
    } else if (isIOS) {
      el.iosGuideModal.classList.add('active');
    } else {
      showToast('ব্রাউজার মেনু থেকে "Add to Home Screen" নির্বাচন করুন।', 'success');
    }
  };

  if (el.pwaInstallBtn) el.pwaInstallBtn.addEventListener('click', handleInstallClick);
  if (el.appinfoInstallBtn) el.appinfoInstallBtn.addEventListener('click', handleInstallClick);

  window.addEventListener('appinstalled', () => {
    if (el.pwaInstallBtn) el.pwaInstallBtn.style.display = 'none';
    showToast('Jononi Pharmacy সফলভাবে ইনস্টল হয়েছে!', 'success');
  });

  if (el.iosGuideCloseBtn) {
    el.iosGuideCloseBtn.addEventListener('click', () => {
      el.iosGuideModal.classList.remove('active');
    });
  }

  // Online / Offline Detection
  const updateOnlineStatus = () => {
    if (el.offlineBanner) {
      if (navigator.onLine) {
        el.offlineBanner.classList.remove('active');
      } else {
        el.offlineBanner.classList.add('active');
      }
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// --- EVENT LISTENERS INITIALIZATION ---
function initEventListeners() {
  // 1. Brand Header Click -> Acts as Home Dashboard
  if (el.headerBrandLink) {
    const handleHomeClick = (e) => {
      e.preventDefault();
      switchTab('tab-home');
      closeMobileSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    el.headerBrandLink.addEventListener('click', handleHomeClick);
    el.headerBrandLink.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleHomeClick(e);
      }
    });
  }

  if (el.btnHeroNewMemo) {
    el.btnHeroNewMemo.addEventListener('click', () => {
      switchTab('tab-editor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (el.tabShortcuts) {
    el.tabShortcuts.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab-shortcut');
        if (targetTab) {
          switchTab(targetTab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // 2. Initialize Sidebar Controls
  initSidebar();

  // 3. Theme toggles
  if (el.themeBtn) {
    el.themeBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }
  if (el.btnAndroidToggle) {
    el.btnAndroidToggle.addEventListener('click', () => {
      const isActive = document.body.classList.contains('android-small-mode');
      applyAndroidSmallMode(!isActive);
    });
  }
  if (el.settingsThemeLight) {
    el.settingsThemeLight.addEventListener('click', () => applyTheme('light'));
  }
  if (el.settingsThemeDark) {
    el.settingsThemeDark.addEventListener('click', () => applyTheme('dark'));
  }

  // 4. Language buttons
  if (el.langBnBtn) el.langBnBtn.addEventListener('click', () => setLanguage('bn'));
  if (el.langEnBtn) el.langEnBtn.addEventListener('click', () => setLanguage('en'));
  if (el.settingsLangBn) el.settingsLangBn.addEventListener('click', () => setLanguage('bn'));
  if (el.settingsLangEn) el.settingsLangEn.addEventListener('click', () => setLanguage('en'));

  // 5. Date picker listener
  if (el.inputDate) {
    el.inputDate.addEventListener('change', (e) => {
      state.currentDate = e.target.value;
      const suggested = state.getSuggestedMemoNo(state.currentDate);
      el.inputMemoNo.value = suggested;
      updateLivePreview();
    });
  }

  // 6. Memo No listener
  if (el.inputMemoNo) {
    el.inputMemoNo.addEventListener('input', () => {
      updateLivePreview();
    });
  }

  // 7. Customer Name listener
  if (el.inputCustomerName) {
    el.inputCustomerName.addEventListener('input', (e) => {
      state.customerName = e.target.value;
      updateLivePreview();
    });
  }

  // 8. Customer Mobile listener (with 11-digit real-time validation)
  if (el.inputCustomerMobile) {
    el.inputCustomerMobile.addEventListener('input', (e) => {
      state.customerMobile = e.target.value;
      validateMobileNumberInput(true);
      updateLivePreview();
    });
  }

  // 8.5. Customer Address listener
  if (el.inputCustomerAddress) {
    el.inputCustomerAddress.addEventListener('input', (e) => {
      state.customerAddress = e.target.value;
      updateLivePreview();
    });
  }

  // 9. Add Item button
  if (el.btnAddItem) {
    el.btnAddItem.addEventListener('click', addItemRow);
  }

  // 10. Discount input with mouse wheel scroll protection
  if (el.inputDiscount) {
    el.inputDiscount.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    el.inputDiscount.addEventListener('input', (e) => {
      state.discount = e.target.value;
      updateLivePreview();
    });
  }

  // 11. Paid input with mouse wheel scroll protection
  if (el.inputPaid) {
    el.inputPaid.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    el.inputPaid.addEventListener('input', (e) => {
      state.paid = e.target.value;
      updateLivePreview();
    });
  }

  // Payment method & advance listeners
  if (el.inputPaymentMethod) {
    el.inputPaymentMethod.addEventListener('change', (e) => {
      state.paymentMethod = e.target.value;
      updateLivePreview();
    });
  }
  if (el.inputAdvanceAmount) {
    el.inputAdvanceAmount.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    el.inputAdvanceAmount.addEventListener('input', (e) => {
      state.advanceAmount = e.target.value;
      updateLivePreview();
    });
  }
  if (el.inputAdvanceMethod) {
    el.inputAdvanceMethod.addEventListener('change', (e) => {
      state.advanceMethod = e.target.value;
      updateLivePreview();
    });
  }

  // 12. Global protection: Prevent number input value change on mouse wheel
  document.addEventListener(
    'wheel',
    (e) => {
      const target = e.target;
      if (target && target.tagName === 'INPUT' && target.type === 'number') {
        e.preventDefault();
        target.blur();
      }
    },
    { passive: false }
  );

  // 13. Reset button
  if (el.btnResetForm) {
    el.btnResetForm.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        'নতুন মেমো তৈরি করবেন?',
        'বর্তমান ফর্মের তথ্য খালি হয়ে যাবে। এগিয়ে যাবেন?'
      );
      if (confirmed) {
        resetForm(true);
        showToast('ফর্ম খালি করা হয়েছে।', 'success');
      }
    });
  }

  // 14. Export & Action Buttons (Desktop & Preview)
  if (el.btnDownloadPng) el.btnDownloadPng.addEventListener('click', handleDownloadPng);
  if (el.btnDownloadPdf) el.btnDownloadPdf.addEventListener('click', handleDownloadPdf);
  if (el.btnShareMemo) el.btnShareMemo.addEventListener('click', handleShareMemo);
  if (el.btnSaveMemo) el.btnSaveMemo.addEventListener('click', handleSaveMemo);

  // 15. Export & Action Buttons (Mobile Sticky Bar)
  if (el.mobileBtnPng) el.mobileBtnPng.addEventListener('click', handleDownloadPng);
  if (el.mobileBtnShare) el.mobileBtnShare.addEventListener('click', handleShareMemo);
  if (el.mobileBtnSave) el.mobileBtnSave.addEventListener('click', handleSaveMemo);

  if (el.btnReloadApp) {
    el.btnReloadApp.addEventListener('click', () => {
      const overlay = document.getElementById('animation-overlay');
      const textContainer = document.getElementById('animation-text');
      if (!overlay || !textContainer) {
        window.location.reload();
        return;
      }

      const text = 'Jononi Pharmacy';
      textContainer.innerHTML = '';

      text.split('').forEach((char, i) => {
        const span = document.createElement('span');
        if (char === ' ') {
          span.className = 'anim-letter space';
          span.innerHTML = '&nbsp;';
        } else {
          span.textContent = char;
          span.className = 'anim-letter';
          
          // Generate randomized 3D shatter/assembly offsets
          const randomX = (Math.random() - 0.5) * 350;
          const randomY = (Math.random() - 0.5) * 350;
          const randomZ = (Math.random() - 0.5) * 400 + 200;
          const randomRx = (Math.random() - 0.5) * 360;
          const randomRy = (Math.random() - 0.5) * 360;

          span.style.setProperty('--tx', `${randomX}px`);
          span.style.setProperty('--ty', `${randomY}px`);
          span.style.setProperty('--tz', `${randomZ}px`);
          span.style.setProperty('--rx', `${randomRx}deg`);
          span.style.setProperty('--ry', `${randomRy}deg`);
          
          span.style.animationDelay = `${i * 0.065}s`;
        }
        textContainer.appendChild(span);
      });

      overlay.style.display = 'flex';

      setTimeout(() => {
        window.location.reload();
      }, 2100);
    });
  }

  // 16. History search input
  if (el.historySearchInput) {
    el.historySearchInput.addEventListener('input', () => {
      const history = getSavedHistory();
      renderHistoryList(history);
    });
  }

  // 16.5. History filter pills
  if (el.historyFilterBtns) {
    el.historyFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        if (filter) setHistoryFilter(filter);
      });
    });
  }

  // 16.6. View Memo Modal Action Controls
  if (el.viewMemoModalClose) {
    el.viewMemoModalClose.addEventListener('click', closeViewMemoModal);
  }
  if (el.btnViewModalCloseBottom) {
    el.btnViewModalCloseBottom.addEventListener('click', closeViewMemoModal);
  }
  if (el.btnViewModalPrint) {
    el.btnViewModalPrint.addEventListener('click', () => {
      window.print();
    });
  }
  if (el.btnViewModalPng) {
    el.btnViewModalPng.addEventListener('click', async () => {
      if (!currentViewingMemo || !el.viewMemoPaperContainer) return;
      const paper = el.viewMemoPaperContainer.querySelector('.memo-paper-standalone');
      if (!paper) return;
      showToast('PNG তৈরি হচ্ছে...', 'success');
      try {
        const canvas = await html2canvas(paper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        const cleanNo = (currentViewingMemo.memoNo || 'memo').replace(/[^a-zA-Z0-9-_]/g, '');
        link.download = `Jononi-Memo-${cleanNo}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('PNG ডাউনলোড সফল হয়েছে!', 'success');
      } catch (e) {
        console.warn('Export PNG error:', e);
        showToast('PNG তৈরিতে সমস্যা হয়েছে।', 'danger');
      }
    });
  }
  if (el.btnViewModalPdf) {
    el.btnViewModalPdf.addEventListener('click', async () => {
      if (!currentViewingMemo || !el.viewMemoPaperContainer) return;
      const paper = el.viewMemoPaperContainer.querySelector('.memo-paper-standalone');
      if (!paper) return;
      showToast('PDF তৈরি হচ্ছে...', 'success');
      try {
        const canvas = await html2canvas(paper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
        const imgWidth = 148;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
        const cleanNo = (currentViewingMemo.memoNo || 'memo').replace(/[^a-zA-Z0-9-_]/g, '');
        pdf.save(`Jononi-Memo-${cleanNo}.pdf`);
        showToast('PDF ডাউনলোড সফল হয়েছে!', 'success');
      } catch (e) {
        console.warn('Export PDF error:', e);
        showToast('PDF তৈরিতে সমস্যা হয়েছে।', 'danger');
      }
    });
  }
  if (el.btnViewModalShare) {
    el.btnViewModalShare.addEventListener('click', () => {
      if (currentViewingMemo) shareMemoCardData(currentViewingMemo);
    });
  }
  if (el.btnViewModalEdit) {
    el.btnViewModalEdit.addEventListener('click', () => {
      if (currentViewingMemo) {
        reopenMemo(currentViewingMemo);
        closeViewMemoModal();
      }
    });
  }

  // 17. Logo upload & remove
  if (el.btnUploadLogo) el.btnUploadLogo.addEventListener('click', () => el.logoFileInput.click());
  if (el.logoFileInput) {
    el.logoFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleLogoUpload(e.target.files[0]);
      }
    });
  }
  if (el.btnRemoveLogo) el.btnRemoveLogo.addEventListener('click', handleLogoRemove);

  // 18. Profile Save Button
  if (el.btnSaveProfile) {
    el.btnSaveProfile.addEventListener('click', saveProfileTab);
  }

  // 19. Report Filter Buttons & Print
  if (el.reportFilterBtns) {
    el.reportFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        if (range) setReportRange(range);
      });
    });
  }
  if (el.btnPrintReport) {
    el.btnPrintReport.addEventListener('click', () => {
      window.print();
    });
  }

  if (el.reportCustomerSearch) {
    el.reportCustomerSearch.addEventListener('input', handleReportCustomerSearch);
  }

  // 20. Custom Footer Wish Note Save
  const storedFooterWish = Storage.get(STORAGE_KEYS.FOOTER_WISH);
  if (storedFooterWish && el.settingsFooterWish) {
    el.settingsFooterWish.value = storedFooterWish;
  }
  if (el.btnSaveFooterWish) {
    el.btnSaveFooterWish.addEventListener('click', () => {
      const wish = el.settingsFooterWish.value.trim();
      if (wish) {
        Storage.set(STORAGE_KEYS.FOOTER_WISH, wish);
        if (state.lang === 'bn') {
          el.pvFooterText.textContent = wish;
        }
        showToast('মেমোর ফুটার শুভেচ্ছা বার্তা আপডেট করা হয়েছে!', 'success');
      }
    });
  }

  // 21. Backup & Restore (Sidebar and Settings Tab buttons)
  const wireBackupButton = (btn) => {
    if (btn) btn.addEventListener('click', handleBackupJson);
  };
  wireBackupButton(el.btnBackupJson);
  wireBackupButton(el.btnBackupJsonTab);

  if (el.btnRestoreJsonTab && el.restoreFileInputTab) {
    el.btnRestoreJsonTab.addEventListener('click', () => el.restoreFileInputTab.click());
    el.restoreFileInputTab.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleRestoreJson(e.target.files[0]);
      }
    });
  }

  // 22. Danger Zone: Clear all memos from Firebase Cloud
  if (el.btnClearAllData) {
    el.btnClearAllData.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        'সমস্ত মেমো ডেটা মুছে ফেলবেন?',
        'সতর্কতা: গুগল ফায়ারবেস ক্লাউডের সমস্ত মেমো ইতিহাস এবং কাউন্টার মুছে যাবে। এই কাজটি আর ফিরিয়ে আনা যাবে না।'
      );
      if (confirmed) {
        if (auth.currentUser) {
          try {
            await clearAllCloudData();
            cloudMemos = [];
            cloudCounters = {};
            showToast('গুগল ক্লাউড থেকে সমস্ত মেমো মুছে ফেলা হয়েছে।', 'success');
          } catch (err) {
            console.error('Clear cloud data error:', err);
          }
        }
        resetForm(true);
        updateHistoryTab();
        updateReportTab();
        updateBackupTab();
      }
    });
  }

  // 22.5. Firebase Auth Login & Logout buttons
  const btnCloudLogin = document.getElementById('btn-cloud-login');
  if (btnCloudLogin) {
    btnCloudLogin.addEventListener('click', async () => {
      try {
        await loginWithGoogle();
        showToast('গুগল অ্যাকাউন্ট দিয়ে ক্লাউডে সাইন-ইন সফল হয়েছে!', 'success');
      } catch (err) {
        console.error('Google login error:', err);
        showToast('সাইন-ইন সম্পন্ন হয়নি।', 'danger');
      }
    });
  }

  const btnCloudLogout = document.getElementById('btn-cloud-logout');
  if (btnCloudLogout) {
    btnCloudLogout.addEventListener('click', async () => {
      try {
        await logoutUser();
        showToast('লগআউট সম্পন্ন হয়েছে।', 'success');
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }


  // 23. Preview collapse toggle listeners
  if (el.btnTogglePreview) {
    el.btnTogglePreview.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePreviewCollapse();
    });
  }

  if (el.previewToolbarHeader) {
    el.previewToolbarHeader.addEventListener('click', () => {
      togglePreviewCollapse();
    });
  }

  if (el.previewCollapsedTeaser) {
    el.previewCollapsedTeaser.addEventListener('click', () => {
      togglePreviewCollapse(false); // Expand
    });
  }

  // 24. Products Management event listeners
  if (el.btnOpenAddProduct) {
    el.btnOpenAddProduct.addEventListener('click', () => openProductModal(null));
  }
  if (el.productModalCancel) {
    el.productModalCancel.addEventListener('click', closeProductModal);
  }
  if (el.productForm) {
    el.productForm.addEventListener('submit', saveProductFromModal);
  }
  if (el.productSearchInput) {
    el.productSearchInput.addEventListener('input', () => {
      const products = getSavedProducts();
      renderProductsList(products);
    });
  }

  // 24.1. Product Category Filter Pills
  if (el.productFilterBtns) {
    el.productFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat') || 'all';
        setProductCategoryFilter(cat);
      });
    });
  }

  // 24.2. View Product Modal Action Listeners
  if (el.viewProductModalClose) {
    el.viewProductModalClose.addEventListener('click', closeViewProductModal);
  }
  if (el.btnViewProdClose) {
    el.btnViewProdClose.addEventListener('click', closeViewProductModal);
  }
  if (el.btnViewProdEdit) {
    el.btnViewProdEdit.addEventListener('click', () => {
      if (currentViewingProduct) {
        closeViewProductModal();
        openProductModal(currentViewingProduct);
      }
    });
  }
  if (el.btnViewProdAdd) {
    el.btnViewProdAdd.addEventListener('click', () => {
      if (currentViewingProduct) {
        addCatalogProductToMemo(currentViewingProduct);
        closeViewProductModal();
        switchTab('tab-editor');
      }
    });
  }

  // 25. Catalog Picker Modal listeners (New Memo saved product picker)
  if (el.btnOpenCatalogPicker) {
    el.btnOpenCatalogPicker.addEventListener('click', openCatalogPickerModal);
  }
  if (el.catalogPickerClose) {
    el.catalogPickerClose.addEventListener('click', closeCatalogPickerModal);
  }
  if (el.catalogPickerDone) {
    el.catalogPickerDone.addEventListener('click', closeCatalogPickerModal);
  }
  if (el.catalogPickerSearch) {
    el.catalogPickerSearch.addEventListener('input', renderCatalogPickerItems);
  }

  // 26. Window resize scaler
  window.addEventListener('resize', fitPreviewScale);
}

// --- FIREBASE CLOUD HELPERS ---
function updateFirebaseUI(user) {
  const loginBtn = document.getElementById('btn-cloud-login');
  const userInfo = document.getElementById('cloud-user-info');
  const userName = document.getElementById('cloud-user-name');
  const statusDot = document.getElementById('firebase-status-dot');
  const bannerText = document.getElementById('firebase-banner-text');
  const cloudBadge = document.getElementById('firebase-cloud-badge');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'inline-flex';
    if (userName) userName.textContent = user.displayName || user.email || 'Jononi Staff';
    if (statusDot) {
      statusDot.classList.remove('offline');
      statusDot.title = 'গুগল ফায়ারবেস ক্লাউডে লাইভ সংযুক্ত';
    }
    if (bannerText) {
      bannerText.innerHTML = `সংযুক্ত: <strong>${escapeHtml(user.email || user.displayName || 'Online')}</strong>`;
    }
    if (cloudBadge) {
      cloudBadge.textContent = '☁️ ক্লাউড সংযুক্ত (jononi-pharmacy)';
      cloudBadge.className = 'status-pill paid';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userInfo) userInfo.style.display = 'none';
    if (statusDot) {
      statusDot.classList.add('offline');
      statusDot.title = 'লগইন প্রয়োজন';
    }
    if (bannerText) {
      bannerText.innerHTML = `সাইন-ইন প্রয়োজন`;
    }
    if (cloudBadge) {
      cloudBadge.textContent = '⚠️ লগইন প্রয়োজন (Firebase)';
      cloudBadge.className = 'status-pill due';
    }
  }
}

function applyCloudProfile(p) {
  if (!p) return;
  if (p.pharmacyName && el.profileShopName) el.profileShopName.value = p.pharmacyName;
  if (p.pharmacistName && el.profilePharmacistName) el.profilePharmacistName.value = p.pharmacistName;
  if (p.dlNo && el.profileDlNo) el.profileDlNo.value = p.dlNo;
  if (p.mobile && el.profileMobile) el.profileMobile.value = p.mobile;
  if (p.address && el.profileAddress) el.profileAddress.value = p.address;
  if (p.customLogo) {
    state.customLogo = p.customLogo;
    updateLogoDisplays();
  }
  if (p.footerWish) {
    if (el.settingsFooterWish) el.settingsFooterWish.value = p.footerWish;
    if (el.pvFooterText && state.lang === 'bn') el.pvFooterText.textContent = p.footerWish;
  }
}

async function migrateLocalDataToCloud(user) {
  try {
    const localHistory = JSON.parse(localStorage.getItem('jp_history') || '[]');
    if (Array.isArray(localHistory) && localHistory.length > 0) {
      for (const m of localHistory) {
        await saveMemoToCloud(m);
      }
      localStorage.removeItem('jp_history');
      console.log(`Migrated ${localHistory.length} local memos to Google Firebase.`);
    }

    const localProducts = JSON.parse(localStorage.getItem('jp_products') || '[]');
    if (Array.isArray(localProducts) && localProducts.length > 0) {
      for (const p of localProducts) {
        await saveProductToCloud(p);
      }
      localStorage.removeItem('jp_products');
      console.log(`Migrated ${localProducts.length} local products to Google Firebase.`);
    }

    // Purge any residual local business data keys so local device holds no application data
    localStorage.removeItem('jp_trash');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('jp_counter_')) {
        localStorage.removeItem(k);
      }
    }
  } catch (err) {
    console.warn('Migration status:', err);
  }
}

// --- BOOTSTRAP APPLICATION ---
function initApp() {
  initTheme();
  updateLogoDisplays();
  loadProfileTab();

  // Ensure legacy android small mode is permanently purged from body and storage
  document.body.classList.remove('android-small-mode');
  try {
    localStorage.removeItem('jp_android_small');
  } catch (err) {}

  // Set initial Date & Memo No
  el.inputDate.value = state.currentDate;
  el.inputMemoNo.value = state.getSuggestedMemoNo(state.currentDate);

  setLanguage(state.lang);
  updateHistoryTab();
  updateRecycleBinTab();
  updateProductsTab();
  updatePreviewCollapseUI();
  initEventListeners();
  initPWA();

  switchTab('tab-home');
  updateHomeDashboard();

  setTimeout(fitPreviewScale, 100);

  // Setup Google Firebase Auth & Cloud Firestore sync
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateFirebaseUI(user);

    if (user) {
      // 1. Subscribe to Cloud Memos in real-time
      if (unsubscribeMemosFn) unsubscribeMemosFn();
      unsubscribeMemosFn = subscribeMemos((memos) => {
        cloudMemos = memos;
        updateHistoryTab();
        updateReportTab();
        updateHomeDashboard();
        updateBackupTab();
      }, (err) => console.warn('Memos sync error:', err));

      // 2. Subscribe to Cloud Products in real-time
      if (unsubscribeProductsFn) unsubscribeProductsFn();
      unsubscribeProductsFn = subscribeProducts((products) => {
        cloudProducts = products;
        updateProductsTab();
        updateHomeDashboard();
      }, (err) => console.warn('Products sync error:', err));

      // 3. Subscribe to Cloud Trash in real-time
      if (unsubscribeTrashFn) unsubscribeTrashFn();
      unsubscribeTrashFn = subscribeTrash((trash) => {
        cloudTrash = trash;
        updateRecycleBinTab();
      });

      // 4. Load Cloud Counters
      loadCountersFromCloud().then(c => {
        if (c) cloudCounters = c;
      });

      // 5. Load Cloud Profile
      loadProfileFromCloud().then(p => {
        if (p) applyCloudProfile(p);
      });

      // 6. Migrate any existing local data into Google Firebase and clean local device
      await migrateLocalDataToCloud(user);
    } else {
      if (unsubscribeMemosFn) { unsubscribeMemosFn(); unsubscribeMemosFn = null; }
      if (unsubscribeProductsFn) { unsubscribeProductsFn(); unsubscribeProductsFn = null; }
      if (unsubscribeTrashFn) { unsubscribeTrashFn(); unsubscribeTrashFn = null; }
      cloudMemos = [];
      cloudProducts = [];
      cloudCounters = {};
      cloudTrash = [];
      updateHistoryTab();
      updateRecycleBinTab();
      updateProductsTab();
      updateHomeDashboard();
      updateBackupTab();
    }
  });
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


