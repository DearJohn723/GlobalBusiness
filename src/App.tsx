import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Globe, 
  Mail, 
  Plus, 
  Trash2, 
  Send, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  User, 
  LogOut, 
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  ExternalLink,
  Languages,
  AlertCircle,
  ShieldCheck,
  Save,
  X,
  Star,
  StarOff
} from 'lucide-react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer,
  arrayUnion
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { COUNTRIES } from './constants';

// --- Types ---
interface Platform {
  name: string;
  url: string;
}

interface AppSettings {
  platforms: Platform[];
  companyName?: string;
  contactEmail?: string;
}

interface OutreachHistory {
  date: any;
  subject: string;
  message: string;
}

interface Lead {
  id: string;
  name: string;
  website: string;
  description?: string;
  country?: string;
  platform?: string;
  contactInfo?: string;
  status: 'new' | 'contacted' | 'responded' | 'rejected';
  createdAt: any;
  authorUid: string;
  searchKeyword?: string;
  outreachHistory?: OutreachHistory[];
  isFavorite?: boolean;
  translations?: {
    [lang: string]: {
      name: string;
      description?: string;
    }
  };
}

interface KeywordSet {
  id: string;
  name: string;
  keywords: string[];
  createdAt: any;
  authorUid: string;
}

type Language = 'en' | 'zh-TW' | 'zh-CN';

const UI_STRINGS: Record<Language, any> = {
  'en': {
    leads: 'Leads',
    templates: 'Templates',
    outreach: 'Outreach',
    settings: 'Settings',
    findLeads: 'Find Leads',
    keyword: 'Keyword',
    countries: 'Countries',
    platforms: 'Platforms',
    recentLeads: 'Recent Leads',
    extractContact: 'Extract Contact Info',
    extractingContact: 'Extracting contact info...',
    startOutreach: 'Start Outreach',
    viewOriginal: 'View Original',
    viewTranslated: 'View Translation',
    savedKeywords: 'Saved Keywords',
    addKeywordSet: 'Add Keyword Set',
    keywordSetName: 'Set Name',
    keywordsList: 'Keywords (comma separated)',
    save: 'Save',
    language: 'Language',
    adminSettings: 'Admin Settings',
    platformManagement: 'Platform Management',
    saveAll: 'Save All Settings',
    description: 'Description',
    contact: 'Contact',
    status: 'Status',
    original: 'Original',
    translated: 'Translated',
    translate: 'Translate',
    signOut: 'Sign Out',
    discoverLeads: 'Discover potential business partners worldwide.',
    keywordPlaceholder: 'e.g. Sustainable Fashion Brands',
    addCountry: 'Add Country...',
    searching: 'Searching Global Data...',
    templateTitle: 'Template Title',
    templateTitlePlaceholder: 'e.g. Initial Partnership Inquiry',
    templateContent: 'Content (Chinese or English)',
    templateContentPlaceholder: 'Enter your inquiry content here...',
    saveTemplate: 'Save Template',
    originalContent: 'Original Content',
    aiTranslation: 'AI Translation',
    outreachCenter: 'Outreach Center',
    outreachDesc: 'Compose and send personalized messages to your leads.',
    setup: 'Setup',
    selectLead: 'Select Lead',
    chooseLead: 'Choose a lead...',
    selectTemplate: 'Select Template',
    chooseTemplate: 'Choose a template...',
    generateMessage: 'Generate Message',
    leadDetails: 'Lead Details',
    noContact: 'No contact info extracted yet.',
    messagePreview: 'Message Preview',
    aiPersonalizing: 'AI is personalizing your message...',
    outreachGuide: 'Select a lead and a template, then click "Generate Message" to create your personalized outreach.',
    noResults: 'No leads found. Try different keywords or fewer filters.',
    searchError: 'An error occurred during search. Please try again.',
    searchingDesc: 'Searching global data with AI, this may take a moment...',
    businessProfile: 'Business Profile',
    companyName: 'Company Name',
    contactEmail: 'Contact Email',
    requirements: 'Additional Requirements',
    requirementsPlaceholder: 'e.g. Mention our 20% discount for new partners',
    saveAsTemplate: 'Save as Template',
    templateSaved: 'Template saved successfully!',
    addNewPlatform: 'Add New Platform',
    contentDirection: 'Content Direction',
    generateWithAI: 'Generate with AI',
    aiGenerating: 'AI is generating template...',
    regenerate: 'Regenerate',
    directionPlaceholder: 'e.g. Introduce our new product and ask for partnership',
    contactName: 'Contact Name',
    jobTitle: 'Job Title',
    phone: 'Phone Number',
    companyFeatures: 'Company Features',
    featuredProducts: 'Featured Products',
    featuresPlaceholder: 'e.g. 20 years of industry experience, focusing on high-quality manufacturing',
    productsPlaceholder: 'e.g. Industrial 3D printers, precision sensors',
    targetLanguage: 'Target Language',
    feedback: 'Feedback / Adjustments',
    feedbackPlaceholder: 'e.g. Make it more formal, or emphasize our fast delivery',
    applyFeedback: 'Apply & Regenerate',
    pendingApproval: 'Account Pending Approval',
    pendingApprovalDesc: 'Your account is currently waiting for administrator approval. Please contact the administrator if you believe this is an error.',
    accessDenied: 'Access Denied',
    userManagement: 'User Management',
    approve: 'Approve',
    reject: 'Reject',
    approved: 'Approved',
    pending: 'Pending',
    email: 'Email',
    name: 'Name',
    outreachRecorded: 'Outreach recorded successfully!',
    recordOutreach: 'Record as Sent',
    outreachHistory: 'Outreach History',
    filterByKeyword: 'Filter by Keyword',
    allKeywords: 'All Keywords',
    noHistory: 'No outreach history yet.',
    viewHistory: 'View History',
    hideHistory: 'Hide History',
    subject: 'Subject',
    date: 'Date',
    clearAll: 'Clear All Leads',
    clearConfirm: 'Are you sure you want to clear all leads? (Favorited leads will be kept)',
    favorite: 'Mark as Important',
    unfavorite: 'Remove from Important',
    important: 'Important',
  },
  'zh-TW': {
    leads: '業務線索',
    templates: '開發信模板',
    outreach: '開發中心',
    settings: '系統設定',
    findLeads: '尋找線索',
    keyword: '關鍵字',
    countries: '國家/地區',
    platforms: '平台',
    recentLeads: '最近線索',
    extractContact: '提取聯繫方式',
    extractingContact: '正在提取聯絡方式...',
    startOutreach: '開始開發',
    viewOriginal: '查看原文',
    viewTranslated: '查看翻譯',
    savedKeywords: '已儲存關鍵字',
    addKeywordSet: '新增關鍵字組',
    keywordSetName: '組合名稱',
    keywordsList: '關鍵字 (用逗號隔開)',
    save: '儲存',
    language: '語言',
    adminSettings: '管理員設定',
    platformManagement: '平台管理',
    saveAll: '儲存所有設定',
    description: '描述',
    contact: '聯繫',
    status: '狀態',
    original: '原文',
    translated: '翻譯',
    translate: '翻譯',
    signOut: '登出',
    discoverLeads: '探索全球潛在業務合作夥伴。',
    keywordPlaceholder: '例如：永續時尚品牌',
    addCountry: '新增國家...',
    searching: '正在搜尋全球數據...',
    templateTitle: '模板標題',
    templateTitlePlaceholder: '例如：初步合作洽談',
    templateContent: '內容 (中文或英文)',
    templateContentPlaceholder: '在此輸入您的詢問內容...',
    saveTemplate: '儲存模板',
    originalContent: '原始內容',
    aiTranslation: 'AI 翻譯',
    outreachCenter: '開發中心',
    outreachDesc: '撰寫並發送個性化訊息給您的線索。',
    setup: '設定',
    selectLead: '選擇線索',
    chooseLead: '選擇一個線索...',
    selectTemplate: '選擇模板',
    chooseTemplate: '選擇一個模板...',
    generateMessage: '生成訊息',
    leadDetails: '線索詳情',
    noContact: '尚未提取聯繫方式。',
    messagePreview: '訊息預覽',
    aiPersonalizing: 'AI 正在為您生成個性化訊息...',
    outreachGuide: '選擇線索和模板，然後點擊「生成訊息」來建立您的個性化開發信。',
    noResults: '找不到相關線索，請嘗試更換關鍵字或減少篩選條件。',
    searchError: '搜尋過程中發生錯誤，請稍後再試。',
    searchingDesc: '正在透過 AI 搜尋全球數據，這可能需要一點時間...',
    businessProfile: '商務資料',
    companyName: '公司名稱',
    contactEmail: '聯絡信箱',
    requirements: '額外需求',
    requirementsPlaceholder: '例如：提到我們對新合作夥伴的 20% 折扣',
    saveAsTemplate: '儲存為模板',
    templateSaved: '模板已成功儲存！',
    addNewPlatform: '新增平台',
    contentDirection: '內容方向',
    generateWithAI: '使用 AI 生成',
    aiGenerating: 'AI 正在生成模板...',
    regenerate: '重新生成',
    directionPlaceholder: '例如：介紹我們的新產品，並詢問合作意向',
    contactName: '聯絡人姓名',
    jobTitle: '職稱',
    phone: '電話',
    companyFeatures: '公司特色',
    featuredProducts: '特色產品',
    featuresPlaceholder: '例如：我們擁有 20 年的產業經驗，專注於高品質製造',
    productsPlaceholder: '例如：工業級 3D 列印機、精密感測器',
    targetLanguage: '目標語系',
    feedback: '調整意見',
    feedbackPlaceholder: '例如：語氣再正式一點，或強調我們的快速交貨',
    applyFeedback: '套用並重新生成',
    pendingApproval: '帳號審核中',
    pendingApprovalDesc: '您的帳號目前正在等待管理員審核。如果您認為這是錯誤，請聯繫管理員。',
    accessDenied: '拒絕存取',
    userManagement: '會員管理',
    approve: '核准',
    reject: '拒絕',
    approved: '已核准',
    pending: '待審核',
    email: '電子郵件',
    name: '姓名',
    outreachRecorded: '開發信已記錄！',
    recordOutreach: '記錄為已寄出',
    outreachHistory: '開發記錄',
    filterByKeyword: '按關鍵字篩選',
    allKeywords: '所有關鍵字',
    noHistory: '尚無開發記錄。',
    viewHistory: '查看記錄',
    hideHistory: '隱藏記錄',
    subject: '主旨',
    date: '日期',
    clearAll: '清空所有線索',
    clearConfirm: '您確定要清空所有線索嗎？（已收藏的線索將會保留）',
    favorite: '加入收藏',
    unfavorite: '取消收藏',
    important: '重要',
  },
  'zh-CN': {
    leads: '业务线索',
    templates: '开发信模板',
    outreach: '开发中心',
    settings: '系统设置',
    findLeads: '寻找线索',
    keyword: '关键字',
    countries: '国家/地区',
    platforms: '平台',
    recentLeads: '最近线索',
    extractContact: '提取联系方式',
    extractingContact: '正在提取联系方式...',
    startOutreach: '开始开发',
    viewOriginal: '查看原文',
    viewTranslated: '查看翻译',
    savedKeywords: '已储存关键字',
    addKeywordSet: '新增关键字组',
    keywordSetName: '组合名称',
    keywordsList: '关键字 (用逗号隔開)',
    save: '储存',
    language: '语言',
    adminSettings: '管理员设置',
    platformManagement: '平台管理',
    saveAll: '储存所有设置',
    description: '描述',
    contact: '联系',
    status: '状态',
    original: '原文',
    translated: '翻译',
    translate: '翻译',
    signOut: '登出',
    discoverLeads: '探索全球潜在业务合作伙伴。',
    keywordPlaceholder: '例如：永续时尚品牌',
    addCountry: '国家/地区',
    searching: '正在搜寻全球数据...',
    templateTitle: '模板标题',
    templateTitlePlaceholder: '例如：初步合作洽谈',
    templateContent: '内容 (中文或英文)',
    templateContentPlaceholder: '在此输入您的询问内容...',
    saveTemplate: '储存模板',
    originalContent: '原始内容',
    aiTranslation: 'AI 翻译',
    outreachCenter: '开发中心',
    outreachDesc: '撰写并发送个性化讯息给您的线索。',
    setup: '设置',
    selectLead: '选择线索',
    chooseLead: '选择一个线索...',
    selectTemplate: '选择模板',
    chooseTemplate: '选择一个模板...',
    generateMessage: '生成讯息',
    leadDetails: '线索详情',
    noContact: '尚未提取联系方式。',
    messagePreview: '讯息预览',
    aiPersonalizing: 'AI 正在为您生成个性化讯息...',
    outreachGuide: '选择线索和模板，然后点击「生成讯息」来建立您的个性化开发信。',
    noResults: '找不到相关线索，请尝试更换关键字或减少筛选条件。',
    searchError: '搜寻过程中发生错误，请稍后再试。',
    searchingDesc: '正在通过 AI 搜寻全球数据，這可能需要一点时间...',
    businessProfile: '商务资料',
    companyName: '公司名称',
    contactEmail: '联系邮箱',
    requirements: '额外需求',
    requirementsPlaceholder: '例如：提到我们对新合作伙伴的 20% 折扣',
    saveAsTemplate: '储存为模板',
    templateSaved: '模板已成功储存！',
    addNewPlatform: '新增平台',
    contentDirection: '内容方向',
    generateWithAI: '使用 AI 生成',
    aiGenerating: 'AI 正在生成模板...',
    regenerate: '重新生成',
    directionPlaceholder: '例如：介绍我们的新产品，并询问合作意向',
    contactName: '联系人姓名',
    jobTitle: '职称',
    phone: '电话',
    companyFeatures: '公司特色',
    featuredProducts: '特色产品',
    featuresPlaceholder: '例如：我们拥有 20 年的行业经验，专注于高质量制造',
    productsPlaceholder: '例如：工业级 3D 打印机、精密传感器',
    targetLanguage: '目标语系',
    feedback: '调整意见',
    feedbackPlaceholder: '例如：语气再正式一点，或强调我们的快速交货',
    applyFeedback: '套用并重新生成',
    pendingApproval: '账号审核中',
    pendingApprovalDesc: '您的账号目前正在等待管理员审核。如果您认为这是错误，请联系管理员。',
    accessDenied: '拒绝存取',
    userManagement: '会员管理',
    approve: '核准',
    reject: '拒绝',
    approved: '已核准',
    pending: '待审核',
    email: '电子邮件',
    name: '姓名',
    outreachRecorded: '开发信已记录！',
    recordOutreach: '记录为已寄出',
    outreachHistory: '开发记录',
    filterByKeyword: '按关键字筛选',
    allKeywords: '所有关键字',
    noHistory: '尚无开发记录。',
    viewHistory: '查看记录',
    hideHistory: '隐藏记录',
    subject: '主旨',
    date: '日期',
    clearAll: '清空所有线索',
    clearConfirm: '您确定要清空所有线索吗？（已收藏的线索将会保留）',
    favorite: '加入收藏',
    unfavorite: '取消收藏',
    important: '重要',
  }
};

interface Template {
  id: string;
  title: string;
  originalContent: string;
  translatedContent?: string;
  language?: string;
  createdAt: any;
  authorUid: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Helpers ---
const getAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'undefined') {
    throw new Error("Gemini API Key is missing. Please ensure it is set in the environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const extractEmail = (text: string) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const match = text.match(emailRegex);
  return match ? match[0] : '';
};

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Connection Test ---
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export default function App() {
  const DEFAULT_PLATFORMS = [
    { name: '官網', url: '' },
    { name: 'FB', url: '' },
    { name: 'IG', url: '' },
    { name: 'Youtube', url: '' }
  ];

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'leads' | 'templates' | 'outreach' | 'settings'>('leads');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>('zh-TW');
  const [keywordFilter, setKeywordFilter] = useState<string>('all');
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  
  // Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({ platforms: DEFAULT_PLATFORMS });
  const [userProfile, setUserProfile] = useState<{ 
    companyName?: string; 
    contactEmail?: string;
    contactName?: string;
    jobTitle?: string;
    phone?: string;
    companyFeatures?: string;
    featuredProducts?: string;
    isApproved?: boolean;
    role?: 'admin' | 'user';
    email?: string;
    displayName?: string;
  }>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  
  // Leads State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Global']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});

  // Keywords State
  const [keywordSets, setKeywordSets] = useState<KeywordSet[]>([]);
  const [newKeywordSetName, setNewKeywordSetName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  
  // Templates State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [templateDirection, setTemplateDirection] = useState('');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('English');

  // Outreach State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [outreachKeywords, setOutreachKeywords] = useState('');
  const [outreachRequirements, setOutreachRequirements] = useState('');
  const [outreachLang, setOutreachLang] = useState('English');
  const [outreachFeedback, setOutreachFeedback] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const isAdmin = u.email === "john@greatidea.tw";
        setIsAdminUser(isAdmin);
        
        // Ensure profile exists
        const profileRef = doc(db, 'users', u.uid);
        const profileSnap = await getDocFromServer(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            email: u.email,
            displayName: u.displayName,
            isApproved: isAdmin, // Admin is auto-approved
            role: isAdmin ? 'admin' : 'user',
            createdAt: serverTimestamp()
          });
        } else if (isAdmin && !profileSnap.data()?.isApproved) {
          // Ensure existing admin is approved
          await updateDoc(profileRef, { isApproved: true, role: 'admin' });
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Settings Sync ---
  useEffect(() => {
    const unsubscribeGlobal = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppSettings;
        if (!data.platforms || data.platforms.length === 0) {
          setAppSettings({ platforms: DEFAULT_PLATFORMS });
        } else {
          setAppSettings(data);
        }
      } else {
        setAppSettings({ platforms: DEFAULT_PLATFORMS });
      }
      setIsSettingsLoading(false);
    });

    let unsubscribeProfile = () => {};
    if (user) {
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile(snapshot.data());
        }
      });
    }

    return () => {
      unsubscribeGlobal();
      unsubscribeProfile();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Firestore Sync ---
  useEffect(() => {
    if (!user) return;

    const leadsQuery = query(collection(db, 'leads'), where('authorUid', '==', user.uid));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));

    const templatesQuery = query(collection(db, 'templates'), where('authorUid', '==', user.uid));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Template)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'templates'));

    const keywordsQuery = query(collection(db, 'keywords'), where('authorUid', '==', user.uid));
    const unsubscribeKeywords = onSnapshot(keywordsQuery, (snapshot) => {
      setKeywordSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KeywordSet)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'keywords'));

    return () => {
      unsubscribeLeads();
      unsubscribeTemplates();
      unsubscribeKeywords();
    };
  }, [user]);

  // --- Admin User Management Sync ---
  useEffect(() => {
    if (!isAdminUser) {
      setAllUsers([]);
      return;
    }

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribeUsers();
  }, [isAdminUser]);

  const t = UI_STRINGS[currentLang];

  // --- Keyword Management ---
  const saveKeywordSet = async () => {
    if (!newKeywordSetName || !newKeywords || !user) return;
    try {
      const keywords = newKeywords.split(',').map(k => k.trim()).filter(k => k);
      await addDoc(collection(db, 'keywords'), {
        name: newKeywordSetName,
        keywords,
        createdAt: serverTimestamp(),
        authorUid: user.uid
      });
      setNewKeywordSetName('');
      setNewKeywords('');
      setShowKeywordForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'keywords');
    }
  };

  // --- Translation Helper ---
  const translateLead = async (leadId: string, name: string, description: string | undefined, lang: Language) => {
    if (lang === 'en') return;
    try {
      const target = lang === 'zh-TW' ? 'Traditional Chinese' : 'Simplified Chinese';
      const prompt = `Translate the following business information into ${target}. 
      Name: ${name}
      Description: ${description || 'N/A'}
      Return JSON: { "name": "...", "description": "..." }`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["name", "description"]
          }
        }
      });

      const translated = JSON.parse(response.text || "{}");

      await updateDoc(doc(db, 'leads', leadId), {
        [`translations.${lang}`]: { 
          name: translated.name || name,
          description: translated.description || description
        }
      });
    } catch (error) {
      console.error("Lead translation failed", error);
    }
  };

  // --- Lead Search ---
  const searchLeads = async () => {
    if (!searchQuery || !user) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const countriesStr = selectedCountries.length > 0 
        ? (selectedCountries.includes('Global') ? 'Worldwide (focus on major markets)' : selectedCountries.join(', '))
        : 'Global (any region)';
      const platformsStr = selectedPlatforms.length > 0 
        ? selectedPlatforms.join(', ') 
        : 'All available professional platforms, official business websites, and industry directories';
      
      const prompt = `You are a professional business development researcher. 
      Task: Find 5 high-quality business leads related to "${searchQuery}".
      Target Regions: ${countriesStr}. 
      Target Platforms: ${platformsStr}. 
      
      Requirements:
      1. Use Google Search to find REAL, active companies and their official websites.
      2. For each lead, provide: Name, Official Website URL, and a concise 1-sentence business description.
      3. Ensure the websites are reachable and relevant to the keywords.
      4. If specific leads are hard to find, look for industry leaders, major distributors, or relevant business listings in the target regions.
      
      CRITICAL: Return ONLY a valid JSON array. Do not include any markdown formatting blocks (like \`\`\`json), citations, or extra text.
      Format: [{ "name": "...", "website": "...", "description": "..." }]`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                website: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "website", "description"]
            }
          }
        }
      });

      const text = response.text;
      if (!text || text === "[]") {
        console.warn("AI returned empty results or no text", response);
        setSearchError(t.noResults + " (AI returned no data)");
        return;
      }

      let results = [];
      try {
        results = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse AI response as JSON", text);
        alert("AI Response Format Error: " + text);
        throw new Error("Invalid response format from AI");
      }
      
      if (results.length === 0) {
        setSearchError(t.noResults);
        return;
      }

      const savePromises = results.map(async (res: any) => {
        const leadData = {
          name: res.name || "Unknown Company",
          website: res.website || "",
          description: res.description || "",
          country: selectedCountries.length > 0 ? (selectedCountries.includes('Global') ? 'Global' : selectedCountries[0]) : 'Global',
          platform: selectedPlatforms.join(', ') || 'Web',
          status: 'new',
          createdAt: serverTimestamp(),
          authorUid: user.uid,
          searchKeyword: searchQuery
        };
        
        try {
          const leadRef = await addDoc(collection(db, 'leads'), leadData);
          if (currentLang !== 'en') {
            translateLead(leadRef.id, leadData.name, leadData.description, currentLang);
          }
          // Automatically extract contact info in the background
          extractContact({ id: leadRef.id, ...leadData } as Lead);
          return leadRef;
        } catch (err) {
          console.error("Failed to save lead", err);
          return null;
        }
      });

      await Promise.all(savePromises);
      setSearchQuery('');
    } catch (error) {
      console.error("Search failed", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setSearchError(t.searchError + " (" + errorMsg + ")");
      alert("Search Error: " + errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  // --- Contact Extraction ---
  const extractContact = async (lead: Lead) => {
    if (!user) return;
    try {
      const prompt = `Find the best contact information (email, phone number, or official contact form URL) for the company "${lead.name}" whose website is ${lead.website}. 
      Use Google Search to find real contact details. Provide a concise summary.`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      await updateDoc(doc(db, 'leads', lead.id), {
        contactInfo: response.text
      });
    } catch (error) {
      console.error("Extraction failed", error);
    }
  };

  // --- Template Management ---
  const generateTemplateWithAI = async () => {
    if (!templateDirection || !user) return;
    setIsGeneratingTemplate(true);
    try {
      const langName = currentLang === 'en' ? 'English' : currentLang === 'zh-TW' ? 'Traditional Chinese' : 'Simplified Chinese';
      const prompt = `Generate a professional business outreach email template based on the following direction.
      
      Direction: ${templateDirection}
      
      Sender Information:
      - Company Name: ${userProfile.companyName || '[Company Name]'}
      - Contact Person: ${userProfile.contactName || '[Contact Name]'} (${userProfile.jobTitle || '[Job Title]'})
      - Contact Email: ${userProfile.contactEmail || '[Contact Email]'}
      - Phone: ${userProfile.phone || '[Phone Number]'}
      
      Company Context:
      - Features: ${userProfile.companyFeatures || 'N/A'}
      - Featured Products: ${userProfile.featuredProducts || 'N/A'}
      
      Requirements:
      1. Professional, persuasive, and clear.
      2. Use placeholders like [Recipient Name] or [Lead Company] where appropriate.
      3. The response should be in ${langName}.
      4. Provide ONLY the email body content. No AI chatter.`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setNewTemplateContent(response.text || "");
    } catch (error) {
      console.error("Template generation failed", error);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const saveTemplate = async () => {
    if (!newTemplateTitle || !newTemplateContent || !user) return;
    try {
      await addDoc(collection(db, 'templates'), {
        title: newTemplateTitle,
        originalContent: newTemplateContent,
        createdAt: serverTimestamp(),
        authorUid: user.uid
      });
      setNewTemplateTitle('');
      setNewTemplateContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'templates');
    }
  };

  const translateTemplate = async (template: Template) => {
    if (!user) return;
    setIsTranslating(true);
    try {
      const prompt = `Translate the following business outreach template into ${targetLang}. 
      Maintain a professional and persuasive tone.
      Template: ${template.originalContent}`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      await updateDoc(doc(db, 'templates', template.id), {
        translatedContent: response.text,
        language: targetLang
      });
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  // --- Outreach Generation ---
  const generateOutreach = async (feedback?: string) => {
    if (!selectedLead || !user) return;
    
    setIsGenerating(true);
    try {
      const templateContent = selectedTemplate ? (selectedTemplate.translatedContent || selectedTemplate.originalContent) : '';
      const prompt = `Generate a professional business outreach email for the following lead.
      
      Sender Information:
      - Company Name: ${userProfile.companyName || 'Our Company'}
      - Contact Person: ${userProfile.contactName || 'N/A'} (${userProfile.jobTitle || 'N/A'})
      - Contact Email: ${userProfile.contactEmail || 'N/A'}
      - Phone: ${userProfile.phone || 'N/A'}
      
      Company Context:
      - Features: ${userProfile.companyFeatures || 'N/A'}
      - Featured Products: ${userProfile.featuredProducts || 'N/A'}
      
      Lead Information:
      - Lead Name: ${selectedLead.name}
      - Lead Website: ${selectedLead.website}
      - Lead Description: ${selectedLead.description || 'N/A'}
      
      ${templateContent ? `Outreach Template to follow:
      ${templateContent}` : 'No specific template provided. Please draft a professional outreach message from scratch.'}
      
      Key Points/Keywords to include:
      ${outreachKeywords || 'None'}
      
      Additional Requirements:
      ${outreachRequirements || 'None'}

      ${feedback ? `USER FEEDBACK ON PREVIOUS VERSION:
      "${feedback}"
      Please adjust the message accordingly.` : ''}
      
      CRITICAL REQUIREMENTS:
      1. Return a JSON object with "subject" and "body" fields.
      2. The "subject" should be a compelling email subject line.
      3. The "body" should be the final email content.
      4. DO NOT include any introductory or concluding remarks from the AI.
      5. The message should be in ${outreachLang}.
      6. Make it feel authentic, professional, and specific to their business.`;

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING }
            },
            required: ["subject", "body"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      setGeneratedSubject(result.subject || "");
      setGeneratedMessage(result.body || "");
      if (feedback) setOutreachFeedback('');
    } catch (error) {
      console.error("Generation failed", error);
      alert("Generation failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGenerating(false);
    }
  };

  const recordOutreach = async () => {
    if (!selectedLead || !generatedMessage || !generatedSubject || !user) return;
    
    const historyItem: OutreachHistory = {
      date: new Date(),
      subject: generatedSubject,
      message: generatedMessage
    };
    
    try {
      const leadRef = doc(db, 'leads', selectedLead.id);
      await updateDoc(leadRef, {
        outreachHistory: arrayUnion(historyItem),
        status: 'contacted'
      });
      alert(t.outreachRecorded);
    } catch (error) {
      console.error("Failed to record outreach", error);
      handleFirestoreError(error, OperationType.UPDATE, 'leads');
    }
  };

  const deleteItem = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, col);
    }
  };

  const toggleFavorite = async (lead: Lead) => {
    try {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        isFavorite: !lead.isFavorite
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leads');
    }
  };

  const clearAllLeads = async () => {
    if (!window.confirm(t.clearConfirm)) return;
    
    try {
      const nonFavorites = leads.filter(l => !l.isFavorite);
      const deletePromises = nonFavorites.map(l => deleteDoc(doc(db, 'leads', l.id)));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leads');
    }
  };

  const saveGeneratedAsTemplate = async () => {
    if (!generatedMessage || !user) return;
    try {
      const fullContent = generatedSubject ? `Subject: ${generatedSubject}\n\n${generatedMessage}` : generatedMessage;
      await addDoc(collection(db, 'templates'), {
        title: `Generated Template - ${new Date().toLocaleDateString()}`,
        originalContent: fullContent,
        createdAt: serverTimestamp(),
        authorUid: user.uid
      });
      alert(t.templateSaved);
    } catch (error) {
      console.error("Failed to save template", error);
    }
  };

  const updateUserApproval = async (userId: string, isApproved: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-8">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-serif font-light mb-4 text-[#1a1a1a]">全球業務精準開發站</h1>
          <p className="text-[#5A5A40] mb-12 font-serif italic">尋找線索、提取聯繫方式，並透過 AI 進行全球開發。</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white rounded-full py-4 px-8 font-medium hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-3"
          >
            <User className="w-5 h-5" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && !userProfile.isApproved && !isAdminUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-light mb-4 text-[#1a1a1a]">{t.pendingApproval}</h1>
          <p className="text-[#5A5A40] mb-8 leading-relaxed">
            {t.pendingApprovalDesc}
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-[#f5f5f0] rounded-2xl text-left">
              <p className="text-xs text-[#5A5A40] uppercase tracking-wider mb-1 font-medium">{t.email}</p>
              <p className="text-[#1a1a1a] font-medium">{user.email}</p>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-white border border-[#5A5A40] text-[#5A5A40] rounded-full hover:bg-[#f5f5f0] transition-all duration-300 font-medium"
            >
              <LogOut className="w-5 h-5" />
              {t.signOut}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e5e5e0] flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif font-medium text-xl">全球業務精準開發站</span>
          </div>
          
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('leads')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                activeTab === 'leads' ? "bg-[#5A5A40] text-white" : "hover:bg-[#f5f5f0] text-[#5A5A40]"
              )}
            >
              <Users className="w-5 h-5" />
              <span>{t.leads}</span>
            </button>
            <button 
              onClick={() => setActiveTab('templates')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                activeTab === 'templates' ? "bg-[#5A5A40] text-white" : "hover:bg-[#f5f5f0] text-[#5A5A40]"
              )}
            >
              <FileText className="w-5 h-5" />
              <span>{t.templates}</span>
            </button>
            <button 
              onClick={() => setActiveTab('outreach')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                activeTab === 'outreach' ? "bg-[#5A5A40] text-white" : "hover:bg-[#f5f5f0] text-[#5A5A40]"
              )}
            >
              <Send className="w-5 h-5" />
              <span>{t.outreach}</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                activeTab === 'settings' ? "bg-[#5A5A40] text-white" : "hover:bg-[#f5f5f0] text-[#5A5A40]"
              )}
            >
              <Settings className="w-5 h-5" />
              <span>{t.settings}</span>
            </button>
          </nav>
        </div>
        
        <div className="mt-auto p-8 border-t border-[#e5e5e0]">
          <div className="flex items-center gap-3 mb-6">
            <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-10 h-10 rounded-full border border-[#e5e5e0]" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-[#5A5A40] truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            {t.signOut}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-12">
        <AnimatePresence mode="wait">
          {activeTab === 'leads' && (
            <motion.div 
              key="leads"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto"
            >
              <div className="flex items-end justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-serif font-light mb-2">{t.leads}</h2>
                  <p className="text-[#5A5A40] italic font-serif">{t.discoverLeads}</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0] mb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.keyword}</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5A5A40]" />
                      <input 
                        type="text" 
                        placeholder={t.keywordPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    {/* Saved Keywords Quick Select */}
                    {keywordSets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {keywordSets.map(set => (
                          <button 
                            key={set.id}
                            onClick={() => setSearchQuery(set.keywords.join(', '))}
                            className="text-[10px] px-2 py-1 bg-[#f5f5f0] text-[#5A5A40] rounded-lg hover:bg-[#5A5A40] hover:text-white transition-all"
                          >
                            {set.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.countries}</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-[#f5f5f0] rounded-2xl min-h-[50px]">
                      {selectedCountries.map(c => (
                        <span key={c} className="px-3 py-1 bg-[#5A5A40] text-white rounded-full text-xs flex items-center gap-1">
                          {c}
                          <button onClick={() => setSelectedCountries(prev => prev.filter(item => item !== c))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      <select 
                        onChange={(e) => {
                          if (e.target.value && !selectedCountries.includes(e.target.value)) {
                            setSelectedCountries(prev => [...prev, e.target.value]);
                          }
                        }}
                        className="bg-transparent border-none text-xs focus:ring-0 text-[#5A5A40] font-medium cursor-pointer"
                        value=""
                      >
                        <option value="">{t.addCountry}</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.platforms}</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {appSettings.platforms.map(p => (
                      <label key={p.name} className="flex items-center gap-3 p-4 bg-[#f5f5f0] rounded-2xl cursor-pointer hover:bg-[#e5e5e0] transition-all">
                        <input 
                          type="checkbox" 
                          checked={selectedPlatforms.includes(p.name)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedPlatforms(prev => [...prev, p.name]);
                            else setSelectedPlatforms(prev => prev.filter(item => item !== p.name));
                          }}
                          className="w-5 h-5 rounded border-none text-[#5A5A40] focus:ring-[#5A5A40]"
                        />
                        <span className="text-sm font-medium">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={searchLeads}
                  disabled={isSearching || !searchQuery}
                  className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a35] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  {isSearching ? t.searching : t.findLeads}
                </button>

                {isSearching && (
                  <p className="text-center text-xs text-[#5A5A40] mt-4 animate-pulse">
                    {t.searchingDesc}
                  </p>
                )}

                {searchError && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    {searchError}
                  </div>
                )}
              </div>

              {/* Leads List */}
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl font-serif font-medium">{t.recentLeads} ({leads.length})</h3>
                  
                  {/* Keyword Filter */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#5A5A40] font-medium">{t.filterByKeyword}:</span>
                      <select 
                        value={keywordFilter}
                        onChange={(e) => setKeywordFilter(e.target.value)}
                        className="bg-white border border-[#e5e5e0] rounded-full px-4 py-1.5 text-xs text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40] outline-none"
                      >
                        <option value="all">{t.allKeywords}</option>
                        {Array.from(new Set(leads.map(l => l.searchKeyword).filter(Boolean))).map(kw => (
                          <option key={kw} value={kw}>{kw}</option>
                        ))}
                      </select>
                    </div>
                    
                    {leads.some(l => !l.isFavorite) && (
                      <button 
                        onClick={clearAllLeads}
                        className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-medium hover:bg-red-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t.clearAll}
                      </button>
                    )}
                  </div>
                </div>

                {leads.length === 0 && !isSearching ? (
                  <div className="bg-white rounded-[32px] p-12 border border-[#e5e5e0] text-center">
                    <Search className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
                    <p className="text-[#5A5A40]/50 italic font-serif">{t.noResults}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {leads
                      .filter(l => keywordFilter === 'all' || l.searchKeyword === keywordFilter)
                      .map((lead) => {
                    const translation = lead.translations?.[currentLang];
                    const isShowingOriginal = showOriginal[lead.id];
                    const displayName = (translation && !isShowingOriginal) ? translation.name : lead.name;
                    const displayDescription = (translation && !isShowingOriginal) ? translation.description : lead.description;
                    const isShowingHistory = showHistory[lead.id];

                    return (
                      <motion.div 
                        layout
                        key={lead.id}
                        className="bg-white rounded-[24px] p-6 border border-[#e5e5e0] hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-lg">{displayName}</h4>
                              {translation ? (
                                <button 
                                  onClick={() => setShowOriginal(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}
                                  className="px-2 py-0.5 bg-[#f5f5f0] text-[#5A5A40] rounded-full text-[10px] hover:bg-[#e5e5e0] transition-all"
                                >
                                  {isShowingOriginal ? t.translated : t.original}
                                </button>
                              ) : currentLang !== 'en' && (
                                <button 
                                  onClick={() => translateLead(lead.id, lead.name, lead.description, currentLang)}
                                  className="px-2 py-0.5 bg-[#5A5A40] text-white rounded-full text-[10px] hover:bg-[#4a4a35] transition-all flex items-center gap-1"
                                >
                                  <Languages className="w-3 h-3" />
                                  {t.translate}
                                </button>
                              )}
                            </div>
                            <a 
                              href={lead.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-[#5A5A40] flex items-center gap-1 hover:underline mb-2"
                            >
                              <Globe className="w-3 h-3" />
                              {new URL(lead.website).hostname}
                            </a>
                            {displayDescription && (
                              <p className="text-xs text-gray-500 italic line-clamp-2 mb-4">
                                {displayDescription}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => toggleFavorite(lead)}
                              title={lead.isFavorite ? t.unfavorite : t.favorite}
                              className={cn(
                                "p-2 rounded-full transition-all",
                                lead.isFavorite ? "text-amber-500 bg-amber-50" : "text-gray-300 hover:bg-gray-50 opacity-0 group-hover:opacity-100"
                              )}
                            >
                              {lead.isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => deleteItem('leads', lead.id)}
                              className="p-2 text-red-400 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="px-3 py-1 bg-[#f5f5f0] rounded-full text-[10px] uppercase tracking-wider font-semibold text-[#5A5A40]">
                            {lead.country}
                          </span>
                          <span className="px-3 py-1 bg-[#f5f5f0] rounded-full text-[10px] uppercase tracking-wider font-semibold text-[#5A5A40]">
                            {lead.status}
                          </span>
                          {lead.searchKeyword && (
                            <span className="px-3 py-1 bg-amber-50 rounded-full text-[10px] uppercase tracking-wider font-semibold text-amber-700 flex items-center gap-1">
                              <Search className="w-2 h-2" />
                              {lead.searchKeyword}
                            </span>
                          )}
                        </div>

                        <div className="space-y-4">
                          {lead.contactInfo ? (
                            <div className="bg-[#f5f5f0] rounded-xl p-4 text-xs text-[#5A5A40] font-mono whitespace-pre-wrap">
                              {lead.contactInfo}
                            </div>
                          ) : (
                            <div className="w-full py-2 border border-[#5A5A40]/30 text-[#5A5A40]/50 rounded-full text-sm font-medium flex items-center justify-center gap-2 animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t.extractingContact || 'Extracting contact info...'}
                            </div>
                          )}
                          
                          {lead.outreachHistory && lead.outreachHistory.length > 0 && (
                            <div className="border-t border-[#e5e5e0] pt-4">
                              <button 
                                onClick={() => setShowHistory(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}
                                className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[#5A5A40] hover:text-black transition-all"
                              >
                                {isShowingHistory ? <X className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                {isShowingHistory ? t.hideHistory : `${t.viewHistory} (${lead.outreachHistory.length})`}
                              </button>
                              
                              <AnimatePresence>
                                {isShowingHistory && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden mt-4 space-y-4"
                                  >
                                    {lead.outreachHistory.map((h, idx) => (
                                      <div key={idx} className="p-4 bg-[#f5f5f0] rounded-2xl text-[11px]">
                                        <div className="flex justify-between items-center mb-2 opacity-60">
                                          <span>{h.date?.toDate ? h.date.toDate().toLocaleDateString() : new Date(h.date).toLocaleDateString()}</span>
                                          <span className="uppercase tracking-widest font-bold">{t.subject}</span>
                                        </div>
                                        <p className="font-medium mb-2">{h.subject}</p>
                                        <div className="prose prose-xs max-w-none prose-stone opacity-80 line-clamp-3">
                                          <ReactMarkdown>{h.message}</ReactMarkdown>
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          <button 
                            onClick={() => {
                              setSelectedLead(lead);
                              setActiveTab('outreach');
                            }}
                            className="w-full py-2 bg-[#1a1a1a] text-white rounded-full text-sm font-medium hover:bg-black transition-all flex items-center justify-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            {t.startOutreach}
                          </button>
                        </div>
                      </motion.div>
                    )})}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'templates' && (
            <motion.div 
              key="templates"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto"
            >
              <div className="flex items-end justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-serif font-light mb-2">{t.templates}</h2>
                  <p className="text-[#5A5A40] italic font-serif">{t.discoverLeads}</p>
                </div>
              </div>

              {/* New Template Form */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0] mb-12">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.templateTitle}</label>
                      <input 
                        type="text" 
                        placeholder={t.templateTitlePlaceholder}
                        value={newTemplateTitle}
                        onChange={(e) => setNewTemplateTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.contentDirection}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={t.directionPlaceholder}
                          value={templateDirection}
                          onChange={(e) => setTemplateDirection(e.target.value)}
                          className="flex-1 px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                        />
                        <button 
                          onClick={generateTemplateWithAI}
                          disabled={isGeneratingTemplate || !templateDirection}
                          className="px-6 bg-[#1a1a1a] text-white rounded-2xl hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {isGeneratingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          <span className="hidden md:inline">{t.generateWithAI}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.templateContent}</label>
                      {newTemplateContent && (
                        <button 
                          onClick={generateTemplateWithAI}
                          className="text-[10px] text-[#5A5A40] hover:underline flex items-center gap-1"
                        >
                          <Languages className="w-3 h-3" />
                          {t.regenerate}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <textarea 
                        rows={8}
                        placeholder={t.templateContentPlaceholder}
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                      />
                      {isGeneratingTemplate && (
                        <div className="absolute inset-0 bg-[#f5f5f0]/50 rounded-2xl flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[#5A5A40]" />
                            <p className="text-xs font-serif italic text-[#5A5A40]">{t.aiGenerating}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={saveTemplate}
                    disabled={!newTemplateTitle || !newTemplateContent}
                    className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a35] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {t.saveTemplate}
                  </button>
                </div>
              </div>

              {/* Templates List */}
              <div className="grid grid-cols-1 gap-8">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white rounded-[32px] p-8 border border-[#e5e5e0] relative group">
                    <button 
                      onClick={() => deleteItem('templates', template.id)}
                      className="absolute top-8 right-8 p-2 text-red-400 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-2xl font-serif font-medium mb-6">{template.title}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.originalContent}</label>
                        <div className="p-6 bg-[#f5f5f0] rounded-2xl text-sm leading-relaxed whitespace-pre-wrap">
                          {template.originalContent}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.aiTranslation}</label>
                          <div className="flex items-center gap-2">
                            <select 
                              value={targetLang}
                              onChange={(e) => setTargetLang(e.target.value)}
                              className="text-xs bg-transparent border-none focus:ring-0 text-[#5A5A40] font-medium cursor-pointer"
                            >
                              <option>English</option>
                              <option>Japanese</option>
                              <option>German</option>
                              <option>French</option>
                              <option>Spanish</option>
                            </select>
                            <button 
                              onClick={() => translateTemplate(template)}
                              disabled={isTranslating}
                              className="p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4a4a35] transition-all"
                            >
                              <Languages className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-6 bg-[#1a1a1a] text-white rounded-2xl text-sm leading-relaxed min-h-[150px] relative">
                          {isTranslating ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : template.translatedContent ? (
                            <div className="space-y-4">
                              <p className="whitespace-pre-wrap">{template.translatedContent}</p>
                              <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-widest">
                                <CheckCircle2 className="w-3 h-3" />
                                Translated to {template.language}
                              </div>
                            </div>
                          ) : (
                            <p className="text-white/30 italic">No translation yet. Select a language and click translate.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'outreach' && (
            <motion.div 
              key="outreach"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto"
            >
              <div className="flex items-end justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-serif font-light mb-2">{t.outreachCenter}</h2>
                  <p className="text-[#5A5A40] italic font-serif">{t.outreachDesc}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0] shadow-sm">
                    <h3 className="text-lg font-serif font-medium mb-6 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-[#5A5A40]" />
                      {t.setup}
                    </h3>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.selectLead}</label>
                        <select 
                          value={selectedLead?.id || ""}
                          onChange={(e) => setSelectedLead(leads.find(l => l.id === e.target.value) || null)}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                        >
                          <option value="">{t.chooseLead}</option>
                          {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        {leads.length === 0 && (
                          <p className="text-[10px] text-amber-600 mt-1 italic">
                            * Please find and save leads in the "Leads" tab first.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.selectTemplate}</label>
                        <select 
                          value={selectedTemplate?.id || ""}
                          onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                        >
                          <option value="">{t.chooseTemplate}</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.keyword}</label>
                        <input 
                          type="text" 
                          value={outreachKeywords}
                          onChange={(e) => setOutreachKeywords(e.target.value)}
                          placeholder={t.keywordPlaceholder}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.targetLanguage}</label>
                        <select 
                          value={outreachLang}
                          onChange={(e) => setOutreachLang(e.target.value)}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                        >
                          <option>English</option>
                          <option>Traditional Chinese</option>
                          <option>Simplified Chinese</option>
                          <option>Japanese</option>
                          <option>German</option>
                          <option>French</option>
                          <option>Spanish</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.requirements}</label>
                        <textarea 
                          value={outreachRequirements}
                          onChange={(e) => setOutreachRequirements(e.target.value)}
                          placeholder={t.requirementsPlaceholder}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                          rows={3}
                        />
                      </div>

                      <button 
                        onClick={() => generateOutreach()}
                        disabled={!selectedLead || isGenerating}
                        className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a35] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        {t.generateMessage}
                      </button>
                    </div>
                  </div>

                  {selectedLead && (
                    <div className="bg-[#5A5A40] text-white rounded-[32px] p-8 shadow-sm">
                      <h4 className="text-sm uppercase tracking-widest font-semibold mb-4 opacity-70">{t.leadDetails}</h4>
                      <p className="text-xl font-serif mb-2">{selectedLead.name}</p>
                      <p className="text-sm opacity-80 mb-6">{selectedLead.website}</p>
                      <div className="space-y-4">
                        <div className="p-4 bg-white/10 rounded-2xl text-xs font-mono">
                          {selectedLead.contactInfo || t.noContact}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Preview */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0] shadow-sm min-h-[600px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-serif font-medium">{t.messagePreview}</h3>
                      {generatedMessage && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              const fullText = generatedSubject ? `Subject: ${generatedSubject}\n\n${generatedMessage}` : generatedMessage;
                              navigator.clipboard.writeText(fullText);
                              alert("Copied to clipboard!");
                            }}
                            className="p-3 bg-[#f5f5f0] text-[#5A5A40] rounded-full hover:bg-[#e5e5e0] transition-all"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <a 
                            href={`mailto:${selectedLead?.contactInfo ? extractEmail(selectedLead.contactInfo) : ''}?subject=${encodeURIComponent(generatedSubject)}&body=${encodeURIComponent(generatedMessage)}`}
                            className="p-3 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] transition-all"
                          >
                            <Send className="w-5 h-5" />
                          </a>
                          <button 
                            onClick={saveGeneratedAsTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e0] text-[#5A5A40] rounded-full hover:bg-[#f5f5f0] transition-all text-sm font-medium"
                          >
                            <FileText className="w-4 h-4" />
                            {t.saveAsTemplate}
                          </button>
                          <button 
                            onClick={recordOutreach}
                            className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] transition-all text-sm font-medium"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            {t.recordOutreach}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 bg-[#f5f5f0] rounded-[24px] p-8 relative flex flex-col">
                      {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
                          <p className="text-sm font-serif italic text-[#5A5A40]">{t.aiPersonalizing}</p>
                        </div>
                      ) : generatedMessage ? (
                        <>
                          {generatedSubject && (
                            <div className="mb-4 pb-4 border-b border-[#e5e5e0]">
                              <span className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40] block mb-1">Subject:</span>
                              <p className="font-medium text-[#1a1a1a]">{generatedSubject}</p>
                            </div>
                          )}
                          <div className="flex-1 prose prose-sm max-w-none prose-stone overflow-y-auto mb-6">
                            <ReactMarkdown>{generatedMessage}</ReactMarkdown>
                          </div>
                          
                          {/* Feedback Input */}
                          <div className="mt-auto pt-6 border-t border-[#e5e5e0]">
                            <div className="space-y-3">
                              <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.feedback}</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  value={outreachFeedback}
                                  onChange={(e) => setOutreachFeedback(e.target.value)}
                                  placeholder={t.feedbackPlaceholder}
                                  className="flex-1 px-4 py-3 bg-white rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] text-sm"
                                />
                                <button 
                                  onClick={() => generateOutreach(outreachFeedback)}
                                  disabled={!outreachFeedback || isGenerating}
                                  className="px-6 bg-[#1a1a1a] text-white rounded-2xl hover:bg-black transition-all disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                                >
                                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                                  {t.applyFeedback}
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12">
                          <AlertCircle className="w-12 h-12 text-[#5A5A40]/20 mb-4" />
                          <p className="text-[#5A5A40]/50 font-serif italic">
                            {t.outreachGuide}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {generatedMessage && (
                      <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4 items-start">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                          <strong>Pro Tip:</strong> Review the AI-generated message for accuracy before sending. 
                          You can copy the text or use the "Send" button to open your default email client.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-12"
            >
              {/* Language Settings */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0]">
                <h3 className="text-xl font-serif font-medium mb-8 flex items-center gap-2">
                  <Languages className="w-6 h-6 text-[#5A5A40]" />
                  {t.language}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['en', 'zh-TW', 'zh-CN'] as Language[]).map(lang => (
                    <button 
                      key={lang}
                      onClick={() => setCurrentLang(lang)}
                      className={cn(
                        "py-4 rounded-2xl border-2 transition-all font-medium",
                        currentLang === lang ? "border-[#5A5A40] bg-[#f5f5f0] text-[#5A5A40]" : "border-[#e5e5e0] hover:border-[#5A5A40]"
                      )}
                    >
                      {lang === 'en' ? 'English' : lang === 'zh-TW' ? '繁體中文' : '简体中文'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Profile */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                    <User className="w-6 h-6 text-[#5A5A40]" />
                    {t.businessProfile}
                  </h3>
                  <button 
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
                        alert("Profile updated successfully!");
                      } catch (error) {
                        console.error("Failed to update profile", error);
                      }
                    }}
                    className="text-sm font-medium text-[#5A5A40] hover:underline flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {t.save}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.companyName}</label>
                    <input 
                      type="text" 
                      value={userProfile.companyName || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, companyName: e.target.value })}
                      placeholder="e.g. Great Idea Co."
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.contactEmail}</label>
                    <input 
                      type="email" 
                      value={userProfile.contactEmail || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, contactEmail: e.target.value })}
                      placeholder="e.g. hello@greatidea.tw"
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.contactName}</label>
                    <input 
                      type="text" 
                      value={userProfile.contactName || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, contactName: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.jobTitle}</label>
                    <input 
                      type="text" 
                      value={userProfile.jobTitle || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, jobTitle: e.target.value })}
                      placeholder="e.g. Sales Director"
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.phone}</label>
                    <input 
                      type="text" 
                      value={userProfile.phone || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                      placeholder="e.g. +886 912 345 678"
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 mt-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.companyFeatures}</label>
                    <textarea 
                      value={userProfile.companyFeatures || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, companyFeatures: e.target.value })}
                      placeholder={t.featuresPlaceholder}
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.featuredProducts}</label>
                    <textarea 
                      value={userProfile.featuredProducts || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, featuredProducts: e.target.value })}
                      placeholder={t.productsPlaceholder}
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Keyword Management */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                    <Search className="w-6 h-6 text-[#5A5A40]" />
                    {t.savedKeywords}
                  </h3>
                  <button 
                    onClick={() => setShowKeywordForm(!showKeywordForm)}
                    className="flex items-center gap-2 text-sm font-medium text-[#5A5A40] hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    {t.addKeywordSet}
                  </button>
                </div>

                <AnimatePresence>
                  {showKeywordForm && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-8"
                    >
                      <div className="p-6 bg-[#f5f5f0] rounded-2xl space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.keywordSetName}</label>
                          <input 
                            type="text" 
                            value={newKeywordSetName}
                            onChange={(e) => setNewKeywordSetName(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.keywordsList}</label>
                          <textarea 
                            value={newKeywords}
                            onChange={(e) => setNewKeywords(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                            rows={3}
                          />
                        </div>
                        <button 
                          onClick={saveKeywordSet}
                          className="w-full bg-[#5A5A40] text-white rounded-full py-3 font-medium hover:bg-[#4a4a35] transition-all"
                        >
                          {t.save}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keywordSets.map(set => (
                    <div key={set.id} className="p-6 border border-[#e5e5e0] rounded-2xl group hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium text-lg">{set.name}</h4>
                        <button 
                          onClick={() => deleteItem('keywords', set.id)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {set.keywords.map((k, i) => (
                          <span key={i} className="px-2 py-1 bg-[#f5f5f0] text-[#5A5A40] rounded-lg text-xs">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin User Management */}
              {isAdminUser && (
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0]">
                  <h3 className="text-xl font-serif font-medium mb-8 flex items-center gap-2">
                    <Users className="w-6 h-6 text-[#5A5A40]" />
                    {t.userManagement}
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e5e5e0]">
                          <th className="pb-4 font-medium text-xs uppercase tracking-widest text-[#5A5A40]">{t.name}</th>
                          <th className="pb-4 font-medium text-xs uppercase tracking-widest text-[#5A5A40]">{t.email}</th>
                          <th className="pb-4 font-medium text-xs uppercase tracking-widest text-[#5A5A40]">{t.status}</th>
                          <th className="pb-4 font-medium text-xs uppercase tracking-widest text-[#5A5A40] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f5f0]">
                        {allUsers.map((u) => (
                          <tr key={u.id} className="group">
                            <td className="py-4">
                              <p className="font-medium text-[#1a1a1a]">{u.displayName || 'N/A'}</p>
                            </td>
                            <td className="py-4">
                              <p className="text-sm text-[#5A5A40]">{u.email}</p>
                            </td>
                            <td className="py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium",
                                u.isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {u.isApproved ? t.approved : t.pending}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              {u.email !== "john@greatidea.tw" && (
                                <div className="flex justify-end gap-2">
                                  {!u.isApproved ? (
                                    <button 
                                      onClick={() => updateUserApproval(u.id, true)}
                                      className="px-4 py-2 bg-green-600 text-white rounded-full text-xs font-medium hover:bg-green-700 transition-all"
                                    >
                                      {t.approve}
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => updateUserApproval(u.id, false)}
                                      className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-medium hover:bg-amber-700 transition-all"
                                    >
                                      {t.reject}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Admin Platform Settings */}
              {isAdminUser && (
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e0]">
                  <h3 className="text-xl font-serif font-medium mb-8 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-[#5A5A40]" />
                    {t.platformManagement}
                  </h3>
                  
                  <div className="space-y-6">
                    {appSettings.platforms.map((platform, index) => (
                      <div key={index} className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">Name</label>
                          <input 
                            type="text" 
                            value={platform.name}
                            onChange={(e) => {
                              const newPlatforms = [...appSettings.platforms];
                              newPlatforms[index].name = e.target.value;
                              setAppSettings({ ...appSettings, platforms: newPlatforms });
                            }}
                            className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">Base URL (Optional)</label>
                          <input 
                            type="text" 
                            value={platform.url}
                            onChange={(e) => {
                              const newPlatforms = [...appSettings.platforms];
                              newPlatforms[index].url = e.target.value;
                              setAppSettings({ ...appSettings, platforms: newPlatforms });
                            }}
                            className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const newPlatforms = appSettings.platforms.filter((_, i) => i !== index);
                            setAppSettings({ ...appSettings, platforms: newPlatforms });
                          }}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => setAppSettings({ ...appSettings, platforms: [...appSettings.platforms, { name: '', url: '' }] })}
                      className="w-full py-4 border-2 border-dashed border-[#e5e5e0] text-[#5A5A40] rounded-[24px] hover:border-[#5A5A40] hover:text-[#5A5A40] transition-all flex items-center justify-center gap-2 font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      {t.addNewPlatform}
                    </button>

                    <div className="pt-8 border-t border-[#e5e5e0]">
                      <button 
                        onClick={async () => {
                          try {
                            await setDoc(doc(db, 'settings', 'global'), appSettings);
                            alert("Settings saved successfully!");
                          } catch (error) {
                            console.error("Failed to save settings", error);
                          }
                        }}
                        className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {t.saveAll}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
