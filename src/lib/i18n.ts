// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Internationalization (EN / KO)
// ---------------------------------------------------------------------------

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ── Locale Type ────────────────────────────────────────────────────────────

export type Locale = 'en' | 'ko';

const STORAGE_KEY = 'claude-dashboard-locale';
const SUPPORTED_LOCALES: Locale[] = ['en', 'ko'];

// ── Translation Dictionary ─────────────────────────────────────────────────

type TranslationMap = Record<string, string>;

const translations: Record<Locale, TranslationMap> = {
  en: {
    // -- Sidebar groups --
    'sidebar.inventory': 'INVENTORY',
    'sidebar.monitoring': 'MONITORING',
    'sidebar.overview': 'Overview',
    'sidebar.allItems': 'All Items',
    'sidebar.dependencies': 'Dependencies',
    'sidebar.health': 'Health',
    'sidebar.tokens': 'Tokens',
    'sidebar.profiles': 'Profiles',
    'sidebar.settings': 'Settings',
    'sidebar.bisect': 'Bisect',
    'sidebar.import': 'Import',
    'sidebar.export': 'Export',
    'sidebar.weeklyTop': 'Weekly Top 5',
    'sidebar.unused': 'Unused Items',

    // -- Categories --
    'category.plugin': 'Plugin',
    'category.agent': 'Agent',
    'category.skill': 'Skill',
    'category.hook': 'Hook',
    'category.command': 'Command',
    'category.mcp_server': 'MCP Server',
    'category.rule': 'Rule',
    'category.session': 'Session',
    'category.config': 'Config',

    // -- Buttons --
    'button.add': 'Add',
    'button.edit': 'Edit',
    'button.delete': 'Delete',
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.confirm': 'Confirm',
    'button.close': 'Close',
    'button.refresh': 'Refresh',
    'button.export': 'Export',
    'button.import': 'Import',
    'button.apply': 'Apply',
    'button.preview': 'Preview',
    'button.reset': 'Reset',
    'button.enable': 'Enable',
    'button.disable': 'Disable',
    'button.duplicate': 'Duplicate',
    'button.viewDetails': 'View Details',
    'button.back': 'Back',
    'button.next': 'Next',
    'button.selectAll': 'Select All',
    'button.deselectAll': 'Deselect All',
    'button.startBisect': 'Start Bisect',
    'button.markGood': 'Mark Good',
    'button.markBad': 'Mark Bad',
    'button.cancelBisect': 'Cancel Bisect',

    // -- Modals --
    'modal.deleteTitle': 'Confirm Deletion',
    'modal.deleteMessage': 'Are you sure you want to delete "{name}"? This action cannot be undone.',
    'modal.deleteSuccess': '"{name}" has been deleted.',
    'modal.importTitle': 'Import Profile',
    'modal.importMessage': 'Select a profile file to import.',
    'modal.importSuccess': 'Profile imported successfully.',
    'modal.exportTitle': 'Export Profile',
    'modal.exportMessage': 'Choose items to include in the export.',
    'modal.exportSuccess': 'Profile exported successfully.',
    'modal.overwriteTitle': 'Overwrite Existing Item',
    'modal.overwriteMessage': '"{name}" already exists. Do you want to overwrite it?',

    // -- Errors --
    'error.generic': 'An unexpected error occurred.',
    'error.notFound': 'The requested item was not found.',
    'error.unauthorized': 'Unauthorized. Please check your token.',
    'error.forbidden': 'Access denied.',
    'error.rateLimit': 'Too many requests. Please try again later.',
    'error.networkError': 'Network error. Please check your connection.',
    'error.invalidFile': 'Invalid file format.',
    'error.importFailed': 'Import failed: {reason}',
    'error.exportFailed': 'Export failed: {reason}',
    'error.deleteFailed': 'Delete failed: {reason}',
    'error.loadFailed': 'Failed to load data.',
    'error.saveFailed': 'Failed to save changes.',
    'error.pathTraversal': 'Path traversal detected. Operation blocked.',
    'error.invalidToken': 'Invalid or missing authentication token.',

    // -- Health --
    'health.title': 'Health Status',
    'health.healthy': 'Healthy',
    'health.warning': 'Warning',
    'health.error': 'Error',
    'health.unknown': 'Unknown',
    'health.allHealthy': 'All systems are healthy.',
    'health.issuesFound': '{count} issue(s) detected.',
    'health.lastChecked': 'Last checked: {time}',
    'health.checkNow': 'Check Now',

    // -- Bisect --
    'bisect.title': 'Bisect Debugger',
    'bisect.description': 'Identify a problematic item by binary search. Half of items will be disabled each round.',
    'bisect.round': 'Round {number}',
    'bisect.enabled': '{count} items enabled',
    'bisect.disabled': '{count} items disabled',
    'bisect.verdict': 'Is the problem still occurring?',
    'bisect.found': 'Suspected item: {name}',
    'bisect.notFound': 'Could not isolate a single item.',
    'bisect.inProgress': 'Bisect in progress...',
    'bisect.completed': 'Bisect completed.',
    'bisect.cancelled': 'Bisect cancelled.',

    // -- Import --
    'import.title': 'Import Profile',
    'import.preview': 'Import Preview',
    'import.selectFile': 'Select a profile file (.json)',
    'import.dropHere': 'Drop file here or click to browse',
    'import.newItems': '{count} new item(s)',
    'import.overwriteItems': '{count} item(s) to overwrite',
    'import.skipItems': '{count} item(s) to skip',
    'import.scope': 'Import to scope',
    'import.overwriteExisting': 'Overwrite existing items',
    'import.applying': 'Applying import...',
    'import.complete': 'Import complete. {created} created, {overwritten} overwritten, {skipped} skipped, {failed} failed.',

    // -- Overview --
    'overview.title': 'Dashboard Overview',
    'overview.totalItems': 'Total Items',
    'overview.projectScope': 'Project Scope',
    'overview.globalScope': 'Global Scope',
    'overview.recentlyModified': 'Recently Modified',
    'overview.quickActions': 'Quick Actions',
    'overview.scanTime': 'Last scan: {time}',

    // -- Empty States --
    'empty.noItems': 'No items found.',
    'empty.noItemsInCategory': 'No {category} items found.',
    'empty.noProfiles': 'No profiles available.',
    'empty.noResults': 'No results match your search.',
    'empty.noUnused': 'All items are actively used.',
    'empty.noDependencies': 'No dependencies detected.',
    'empty.getStarted': 'Get started by adding your first item.',

    // -- Tokens --
    'tokens.title': 'Token Usage',
    'tokens.total': 'Total Tokens',
    'tokens.breakdown': 'Breakdown by Category',
    'tokens.activity': 'Activity Over Time',

    // -- Profiles --
    'profiles.title': 'Profiles',
    'profiles.active': 'Active',
    'profiles.inactive': 'Inactive',
    'profiles.itemCount': '{count} items',
    'profiles.createdAt': 'Created: {date}',

    // -- Weekly / Unused --
    'weekly.title': 'Agent · Skill Usage Top 5',
    'weekly.usageCount': '{count} uses',
    'weekly.period': '{start} – {end}',
    'toolTop5.title': 'Tool Usage Top 5',
    'cost.title': 'Cost Breakdown',
    'cost.window': 'Last {days} days',
    'cost.byProject': 'By Project',
    'cost.byAgent': 'By Agent',
    'cost.bySkill': 'By Skill',
    'cost.totalShown': 'Total shown',
    'cost.noData': 'No cost data yet',
    'sessionSearch.title': 'Search inside conversations',
    'sessionSearch.placeholder': 'Search prompts (e.g. "marketplace", "plugin install")',
    'sessionSearch.noHits': 'No matches',
    'sessionSearch.resultCount': '{count} matching session(s)',
    'unused.title': 'Unused Items',
    'unused.daysSince': '{days} days since last use',
    'unused.never': 'Never used',
    'unused.threshold': 'Threshold: {days} days',

    // -- Scope --
    'scope.project': 'Project',
    'scope.global': 'Global',

    // -- Misc --
    'misc.search': 'Search...',
    'misc.filter': 'Filter',
    'misc.sort': 'Sort',
    'misc.loading': 'Loading...',
    'misc.noDescription': 'No description',
    'misc.created': 'Created',
    'misc.lastModified': 'Modified',
    'misc.lastUsed': 'Last used',
    'misc.path': 'Path: {path}',
    'misc.version': 'Version',
    'misc.language': 'Language',
  },

  ko: {
    // -- Sidebar groups --
    'sidebar.inventory': '인벤토리',
    'sidebar.monitoring': '모니터링',
    'sidebar.overview': '개요',
    'sidebar.allItems': '전체 항목',
    'sidebar.dependencies': '의존성',
    'sidebar.health': '상태',
    'sidebar.tokens': '토큰',
    'sidebar.profiles': '프로필',
    'sidebar.settings': '설정',
    'sidebar.bisect': '이분 탐색',
    'sidebar.import': '가져오기',
    'sidebar.export': '내보내기',
    'sidebar.weeklyTop': '주간 Top 5',
    'sidebar.unused': '미사용 항목',

    // -- Categories --
    'category.plugin': '플러그인',
    'category.agent': '에이전트',
    'category.skill': '스킬',
    'category.hook': '훅',
    'category.command': '명령어',
    'category.mcp_server': 'MCP 서버',
    'category.rule': '규칙',
    'category.session': '세션',
    'category.config': '설정',

    // -- Buttons --
    'button.add': '추가',
    'button.edit': '편집',
    'button.delete': '삭제',
    'button.save': '저장',
    'button.cancel': '취소',
    'button.confirm': '확인',
    'button.close': '닫기',
    'button.refresh': '새로고침',
    'button.export': '내보내기',
    'button.import': '가져오기',
    'button.apply': '적용',
    'button.preview': '미리보기',
    'button.reset': '초기화',
    'button.enable': '활성화',
    'button.disable': '비활성화',
    'button.duplicate': '복제',
    'button.viewDetails': '상세 보기',
    'button.back': '뒤로',
    'button.next': '다음',
    'button.selectAll': '전체 선택',
    'button.deselectAll': '전체 해제',
    'button.startBisect': '이분 탐색 시작',
    'button.markGood': '정상',
    'button.markBad': '비정상',
    'button.cancelBisect': '이분 탐색 취소',

    // -- Modals --
    'modal.deleteTitle': '삭제 확인',
    'modal.deleteMessage': '"{name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    'modal.deleteSuccess': '"{name}"이(가) 삭제되었습니다.',
    'modal.importTitle': '프로필 가져오기',
    'modal.importMessage': '가져올 프로필 파일을 선택하세요.',
    'modal.importSuccess': '프로필을 성공적으로 가져왔습니다.',
    'modal.exportTitle': '프로필 내보내기',
    'modal.exportMessage': '내보낼 항목을 선택하세요.',
    'modal.exportSuccess': '프로필을 성공적으로 내보냈습니다.',
    'modal.overwriteTitle': '기존 항목 덮어쓰기',
    'modal.overwriteMessage': '"{name}"이(가) 이미 존재합니다. 덮어쓰시겠습니까?',

    // -- Errors --
    'error.generic': '예상치 못한 오류가 발생했습니다.',
    'error.notFound': '요청한 항목을 찾을 수 없습니다.',
    'error.unauthorized': '인증되지 않았습니다. 토큰을 확인하세요.',
    'error.forbidden': '접근이 거부되었습니다.',
    'error.rateLimit': '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    'error.networkError': '네트워크 오류입니다. 연결 상태를 확인하세요.',
    'error.invalidFile': '잘못된 파일 형식입니다.',
    'error.importFailed': '가져오기 실패: {reason}',
    'error.exportFailed': '내보내기 실패: {reason}',
    'error.deleteFailed': '삭제 실패: {reason}',
    'error.loadFailed': '데이터를 불러오지 못했습니다.',
    'error.saveFailed': '변경사항을 저장하지 못했습니다.',
    'error.pathTraversal': '경로 탐색 공격이 감지되었습니다. 작업이 차단되었습니다.',
    'error.invalidToken': '유효하지 않거나 누락된 인증 토큰입니다.',

    // -- Health --
    'health.title': '상태 현황',
    'health.healthy': '정상',
    'health.warning': '경고',
    'health.error': '오류',
    'health.unknown': '알 수 없음',
    'health.allHealthy': '모든 시스템이 정상입니다.',
    'health.issuesFound': '{count}개의 문제가 감지되었습니다.',
    'health.lastChecked': '마지막 확인: {time}',
    'health.checkNow': '지금 확인',

    // -- Bisect --
    'bisect.title': '이분 탐색 디버거',
    'bisect.description': '이진 탐색으로 문제 항목을 식별합니다. 매 라운드마다 절반의 항목이 비활성화됩니다.',
    'bisect.round': '라운드 {number}',
    'bisect.enabled': '{count}개 항목 활성화됨',
    'bisect.disabled': '{count}개 항목 비활성화됨',
    'bisect.verdict': '문제가 여전히 발생하고 있습니까?',
    'bisect.found': '의심 항목: {name}',
    'bisect.notFound': '단일 항목을 분리할 수 없습니다.',
    'bisect.inProgress': '이분 탐색 진행 중...',
    'bisect.completed': '이분 탐색 완료.',
    'bisect.cancelled': '이분 탐색 취소됨.',

    // -- Import --
    'import.title': '프로필 가져오기',
    'import.preview': '가져오기 미리보기',
    'import.selectFile': '프로필 파일을 선택하세요 (.json)',
    'import.dropHere': '파일을 여기에 놓거나 클릭하여 찾아보기',
    'import.newItems': '{count}개의 새 항목',
    'import.overwriteItems': '{count}개의 덮어쓸 항목',
    'import.skipItems': '{count}개의 건너뛸 항목',
    'import.scope': '가져오기 범위',
    'import.overwriteExisting': '기존 항목 덮어쓰기',
    'import.applying': '가져오기 적용 중...',
    'import.complete': '가져오기 완료. {created}개 생성, {overwritten}개 덮어쓰기, {skipped}개 건너뜀, {failed}개 실패.',

    // -- Overview --
    'overview.title': '대시보드 개요',
    'overview.totalItems': '전체 항목',
    'overview.projectScope': '프로젝트 범위',
    'overview.globalScope': '전역 범위',
    'overview.recentlyModified': '최근 수정됨',
    'overview.quickActions': '빠른 작업',
    'overview.scanTime': '마지막 스캔: {time}',

    // -- Empty States --
    'empty.noItems': '항목이 없습니다.',
    'empty.noItemsInCategory': '{category} 항목이 없습니다.',
    'empty.noProfiles': '사용 가능한 프로필이 없습니다.',
    'empty.noResults': '검색 결과가 없습니다.',
    'empty.noUnused': '모든 항목이 사용 중입니다.',
    'empty.noDependencies': '의존성이 감지되지 않았습니다.',
    'empty.getStarted': '첫 번째 항목을 추가하여 시작하세요.',

    // -- Tokens --
    'tokens.title': '토큰 사용량',
    'tokens.total': '총 토큰',
    'tokens.breakdown': '카테고리별 분석',
    'tokens.activity': '시간별 활동',

    // -- Profiles --
    'profiles.title': '프로필',
    'profiles.active': '활성',
    'profiles.inactive': '비활성',
    'profiles.itemCount': '{count}개 항목',
    'profiles.createdAt': '생성일: {date}',

    // -- Weekly / Unused --
    'weekly.title': '에이전트 · 스킬 사용 Top 5',
    'weekly.usageCount': '{count}회 사용',
    'toolTop5.title': '도구 사용 Top 5',
    'weekly.period': '{start} – {end}',
    'cost.title': '비용 분석',
    'cost.window': '최근 {days}일',
    'cost.byProject': '프로젝트별',
    'cost.byAgent': '에이전트별',
    'cost.bySkill': '스킬별',
    'cost.totalShown': '표시된 합계',
    'cost.noData': '아직 비용 데이터가 없습니다',
    'sessionSearch.title': '대화 내용 검색',
    'sessionSearch.placeholder': '검색어 입력 (예: "marketplace", "플러그인")',
    'sessionSearch.noHits': '검색 결과 없음',
    'sessionSearch.resultCount': '{count}개 세션 일치',
    'unused.title': '미사용 항목',
    'unused.daysSince': '마지막 사용 후 {days}일',
    'unused.never': '사용한 적 없음',
    'unused.threshold': '기준: {days}일',

    // -- Scope --
    'scope.project': '프로젝트',
    'scope.global': '전역',

    // -- Misc --
    'misc.search': '검색...',
    'misc.filter': '필터',
    'misc.sort': '정렬',
    'misc.loading': '로딩 중...',
    'misc.noDescription': '설명 없음',
    'misc.created': '생성',
    'misc.lastModified': '수정',
    'misc.lastUsed': '최근 사용',
    'misc.path': '경로: {path}',
    'misc.version': '버전',
    'misc.language': '언어',
  },
};

// ── Translation Function ───────────────────────────────────────────────────

/**
 * Look up a translated string by key.  Falls back to the English value if the
 * key is missing in the requested locale, and returns the raw key if it is
 * missing from English as well.
 */
export function t(key: string, locale: Locale): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

// ── Locale Detection ───────────────────────────────────────────────────────

function detectInitialLocale(): Locale {
  // 1. Persisted preference
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
        return stored as Locale;
      }
    } catch {
      // localStorage may be unavailable (SSR, privacy mode, etc.)
    }

    // 2. Browser language
    const browserLang = navigator.language?.slice(0, 2);
    if (browserLang && SUPPORTED_LOCALES.includes(browserLang as Locale)) {
      return browserLang as Locale;
    }
  }

  // 3. Default
  return 'en';
}

// ── React Context ──────────────────────────────────────────────────────────

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
});

// ── Provider Component ─────────────────────────────────────────────────────

export interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    defaultLocale ?? detectInitialLocale,
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures
    }
  }, []);

  // Sync to localStorage on mount when using detected locale
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseI18nReturn {
  /** Translate a key using the current locale */
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export function useI18n(): UseI18nReturn {
  const { locale, setLocale } = useContext(I18nContext);

  const translate = useCallback(
    (key: string) => t(key, locale),
    [locale],
  );

  return { t: translate, locale, setLocale };
}
