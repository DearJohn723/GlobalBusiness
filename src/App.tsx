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
  X
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
  getDocFromServer
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
    addNewPlatform: 'Add New Platform',
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
    addNewPlatform: '新增平台',
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
    addCountry: '新增国家...',
    searching: '正在搜寻全球数据...',
    templateTitle: '模板标题',
    templateTitlePlaceholder: '例如：初步合作洽談',
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
    addNewPlatform: '新增平台',
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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'leads' | 'templates' | 'outreach' | 'settings'>('leads');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>('zh-TW');
  
  // Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({ platforms: [] });
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  
  // Leads State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Global']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('English');

  // Outreach State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Check if admin
        setIsAdminUser(u.email === "john@greatidea.tw");
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Settings Sync ---
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setAppSettings(snapshot.data() as AppSettings);
      } else {
        // Initial default settings
        const defaultSettings = {
          platforms: [
            { name: 'LinkedIn', url: 'https://linkedin.com' },
            { name: 'Instagram', url: 'https://instagram.com' },
            { name: 'Twitter', url: 'https://twitter.com' },
            { name: 'Official Websites', url: '' }
          ]
        };
        setAppSettings(defaultSettings);
      }
      setIsSettingsLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

      const response = await ai.models.generateContent({
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
    try {
      const countriesStr = selectedCountries.join(', ');
      const platformsStr = selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'All available platforms';
      
      const prompt = `Search for business leads related to "${searchQuery}" in the following countries: ${countriesStr}. 
      Target platforms: ${platformsStr}. 
      Return a list of 5 potential leads with their name, website URL, and a brief 1-sentence description. 
      Format as JSON array: [{ "name": "...", "website": "...", "description": "..." }]`;

      const response = await ai.models.generateContent({
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

      const results = JSON.parse(response.text || "[]");
      
      for (const res of results) {
        const leadRef = await addDoc(collection(db, 'leads'), {
          name: res.name,
          website: res.website,
          description: res.description,
          country: selectedCountries[0], // Store primary country
          platform: selectedPlatforms.join(', '),
          status: 'new',
          createdAt: serverTimestamp(),
          authorUid: user.uid
        });

        // Auto translate if current lang is Chinese
        if (currentLang !== 'en') {
          translateLead(leadRef.id, res.name, res.description, currentLang);
        }
      }
      setSearchQuery('');
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  // --- Contact Extraction ---
  const extractContact = async (lead: Lead) => {
    if (!user) return;
    try {
      const prompt = `Find the best contact information (email, phone number, or official contact form URL) for the company "${lead.name}" whose website is ${lead.website}. 
      Provide a concise summary of how to reach them.`;

      const response = await ai.models.generateContent({
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

      const response = await ai.models.generateContent({
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
  const generateOutreach = async () => {
    if (!selectedLead || !selectedTemplate || !user) return;
    setIsGenerating(true);
    try {
      const content = selectedTemplate.translatedContent || selectedTemplate.originalContent;
      const prompt = `Personalize this business outreach message for the following lead.
      Lead Name: ${selectedLead.name}
      Lead Website: ${selectedLead.website}
      Template: ${content}
      
      Make it feel authentic and specific to their business.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setGeneratedMessage(response.text || "");
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteItem = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, col);
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
              </div>

              {/* Leads List */}
              <div className="space-y-6">
                <h3 className="text-xl font-serif font-medium mb-6">{t.recentLeads} ({leads.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {leads.map((lead) => {
                    const translation = lead.translations?.[currentLang];
                    const isShowingOriginal = showOriginal[lead.id];
                    const displayName = (translation && !isShowingOriginal) ? translation.name : lead.name;
                    const displayDescription = (translation && !isShowingOriginal) ? translation.description : lead.description;

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
                          <button 
                            onClick={() => deleteItem('leads', lead.id)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="px-3 py-1 bg-[#f5f5f0] rounded-full text-[10px] uppercase tracking-wider font-semibold text-[#5A5A40]">
                            {lead.country}
                          </span>
                          <span className="px-3 py-1 bg-[#f5f5f0] rounded-full text-[10px] uppercase tracking-wider font-semibold text-[#5A5A40]">
                            {lead.status}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {lead.contactInfo ? (
                            <div className="bg-[#f5f5f0] rounded-xl p-4 text-xs text-[#5A5A40] font-mono whitespace-pre-wrap">
                              {lead.contactInfo}
                            </div>
                          ) : (
                            <button 
                              onClick={() => extractContact(lead)}
                              className="w-full py-2 border border-[#5A5A40] text-[#5A5A40] rounded-full text-sm font-medium hover:bg-[#5A5A40] hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <Mail className="w-4 h-4" />
                              {t.extractContact}
                            </button>
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
                    );
                  })}
                </div>
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
                    <label className="text-xs uppercase tracking-widest font-medium text-[#5A5A40]">{t.templateContent}</label>
                    <textarea 
                      rows={6}
                      placeholder={t.templateContentPlaceholder}
                      value={newTemplateContent}
                      onChange={(e) => setNewTemplateContent(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none"
                    />
                  </div>
                  <button 
                    onClick={saveTemplate}
                    disabled={!newTemplateTitle || !newTemplateContent}
                    className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a35] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
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

                      <button 
                        onClick={generateOutreach}
                        disabled={!selectedLead || !selectedTemplate || isGenerating}
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
                              navigator.clipboard.writeText(generatedMessage);
                              alert("Copied to clipboard!");
                            }}
                            className="p-3 bg-[#f5f5f0] text-[#5A5A40] rounded-full hover:bg-[#e5e5e0] transition-all"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <a 
                            href={`mailto:?body=${encodeURIComponent(generatedMessage)}`}
                            className="p-3 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] transition-all"
                          >
                            <Send className="w-5 h-5" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 bg-[#f5f5f0] rounded-[24px] p-8 relative">
                      {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
                          <p className="text-sm font-serif italic text-[#5A5A40]">{t.aiPersonalizing}</p>
                        </div>
                      ) : generatedMessage ? (
                        <div className="prose prose-sm max-w-none prose-stone">
                          <ReactMarkdown>{generatedMessage}</ReactMarkdown>
                        </div>
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
