import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faFolder,
  faFolderOpen,
  faFolderTree,
  faServer,
  faDatabase,
  faCloud,
  faCloudUploadAlt,
  faCloudDownloadAlt,
  faCode,
  faCodeBranch,
  faCog,
  faCogs,
  faBug,
  faFileAlt,
  faFileCode,
  faFileLines,
  faTerminal,
  faNetworkWired,
  faHdd,
  faLayerGroup,
  faGlobe,
  faShieldAlt,
  faMicrochip,
  faCubes,
  faCube,
  faBox,
  faBoxes,
  faIndustry,
  faLaptopCode,
  faClipboardList,
  faChartLine,
  faChartBar,
  faKey,
  faLock,
  faUnlock,
  faRocket,
  faWrench,
  faTools,
  faDesktop,
  faLaptop,
  faMobileAlt,
  faTabletAlt,
  faMemory,
  faHardDrive,
  faPlug,
  faWifi,
  faSatelliteDish,
  faBroadcastTower,
  faSitemap,
  faProjectDiagram,
  faStream,
  faListUl,
  faFilter,
  faSearch,
  faEye,
  faBell,
  faExclamationTriangle,
  faExclamationCircle,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  faFire,
  faBolt,
  faSync,
  faClock,
  faCalendarAlt,
  faHistory,
  faArchive,
  faInbox,
  faEnvelope,
  faComments,
  faUser,
  faUsers,
  faUserShield,
  faUserCog,
  faBuilding,
  faHome,
  faMapMarkerAlt,
  faTruck,
  faShippingFast,
  faStore,
  faShoppingCart,
  faCreditCard,
  faWallet,
  faCoins,
  faChartPie,
  faTachometerAlt,
  faHeartbeat,
  faStethoscope,
  faFlask,
  faVial,
  faAtom,
  faRobot,
  faBrain,
  faMagic,
  faPuzzlePiece,
  faDice,
  faGamepad,
  faMusic,
  faImage,
  faCamera,
  faPrint,
  faBook,
  faBookOpen,
  faNewspaper,
  faTag,
  faTags,
  faBookmark,
  faStar,
  faHeart,
  faFlag,
  faThumbtack,
  faLightbulb,
  faMoon,
  faSun,
  faSnowflake,
  faLeaf,
  faTree,
  faWater,
  faMountain,
} from '@fortawesome/free-solid-svg-icons';

export interface DirectoryIconOption {
  id: string;
  icon: IconDefinition;
  keywords?: string;
}

export const DIRECTORY_ICONS: DirectoryIconOption[] = [
  // Files & folders
  { id: 'folder', icon: faFolder, keywords: 'folder dir' },
  { id: 'folder-open', icon: faFolderOpen, keywords: 'folder open' },
  { id: 'folder-tree', icon: faFolderTree, keywords: 'tree hierarchy' },
  { id: 'file-alt', icon: faFileAlt, keywords: 'file document' },
  { id: 'file-lines', icon: faFileLines, keywords: 'file text log' },
  { id: 'file-code', icon: faFileCode, keywords: 'code source' },
  { id: 'archive', icon: faArchive, keywords: 'archive zip' },
  { id: 'inbox', icon: faInbox, keywords: 'inbox mail' },
  { id: 'bookmark', icon: faBookmark, keywords: 'bookmark' },
  { id: 'tag', icon: faTag, keywords: 'tag label' },
  { id: 'tags', icon: faTags, keywords: 'tags labels' },

  // Infra & servers
  { id: 'server', icon: faServer, keywords: 'server host' },
  { id: 'database', icon: faDatabase, keywords: 'database sql db' },
  { id: 'hdd', icon: faHdd, keywords: 'disk storage' },
  { id: 'hard-drive', icon: faHardDrive, keywords: 'drive storage' },
  { id: 'memory', icon: faMemory, keywords: 'ram memory' },
  { id: 'microchip', icon: faMicrochip, keywords: 'chip cpu' },
  { id: 'cloud', icon: faCloud, keywords: 'cloud' },
  { id: 'cloud-upload', icon: faCloudUploadAlt, keywords: 'upload cloud' },
  { id: 'cloud-download', icon: faCloudDownloadAlt, keywords: 'download cloud' },
  { id: 'network-wired', icon: faNetworkWired, keywords: 'network lan' },
  { id: 'wifi', icon: faWifi, keywords: 'wifi wireless' },
  { id: 'plug', icon: faPlug, keywords: 'plug power' },
  { id: 'broadcast', icon: faBroadcastTower, keywords: 'broadcast tower' },
  { id: 'satellite', icon: faSatelliteDish, keywords: 'satellite antenna' },
  { id: 'globe', icon: faGlobe, keywords: 'globe web www' },
  { id: 'sitemap', icon: faSitemap, keywords: 'sitemap tree' },
  { id: 'project-diagram', icon: faProjectDiagram, keywords: 'diagram graph' },

  // Dev & tools
  { id: 'code', icon: faCode, keywords: 'code' },
  { id: 'code-branch', icon: faCodeBranch, keywords: 'git branch' },
  { id: 'terminal', icon: faTerminal, keywords: 'terminal shell cli' },
  { id: 'laptop-code', icon: faLaptopCode, keywords: 'laptop code' },
  { id: 'desktop', icon: faDesktop, keywords: 'desktop pc' },
  { id: 'laptop', icon: faLaptop, keywords: 'laptop' },
  { id: 'mobile', icon: faMobileAlt, keywords: 'mobile phone' },
  { id: 'tablet', icon: faTabletAlt, keywords: 'tablet' },
  { id: 'cog', icon: faCog, keywords: 'settings config' },
  { id: 'cogs', icon: faCogs, keywords: 'settings gears' },
  { id: 'wrench', icon: faWrench, keywords: 'wrench fix' },
  { id: 'tools', icon: faTools, keywords: 'tools' },
  { id: 'bug', icon: faBug, keywords: 'bug error' },
  { id: 'robot', icon: faRobot, keywords: 'robot ai bot' },
  { id: 'brain', icon: faBrain, keywords: 'brain ai ml' },
  { id: 'flask', icon: faFlask, keywords: 'lab test' },
  { id: 'vial', icon: faVial, keywords: 'test vial' },
  { id: 'atom', icon: faAtom, keywords: 'atom science' },
  { id: 'magic', icon: faMagic, keywords: 'magic wand' },
  { id: 'puzzle', icon: faPuzzlePiece, keywords: 'puzzle plugin' },

  // Layers & packages
  { id: 'layer-group', icon: faLayerGroup, keywords: 'layers' },
  { id: 'cube', icon: faCube, keywords: 'cube' },
  { id: 'cubes', icon: faCubes, keywords: 'cubes blocks' },
  { id: 'box', icon: faBox, keywords: 'box package' },
  { id: 'boxes', icon: faBoxes, keywords: 'boxes packages' },
  { id: 'industry', icon: faIndustry, keywords: 'industry factory' },

  // Monitoring & status
  { id: 'chart-line', icon: faChartLine, keywords: 'chart metrics' },
  { id: 'chart-bar', icon: faChartBar, keywords: 'bar chart' },
  { id: 'chart-pie', icon: faChartPie, keywords: 'pie chart' },
  { id: 'tachometer', icon: faTachometerAlt, keywords: 'dashboard gauge' },
  { id: 'heartbeat', icon: faHeartbeat, keywords: 'health heartbeat' },
  { id: 'stethoscope', icon: faStethoscope, keywords: 'health check' },
  { id: 'eye', icon: faEye, keywords: 'eye view monitor' },
  { id: 'search', icon: faSearch, keywords: 'search find' },
  { id: 'filter', icon: faFilter, keywords: 'filter' },
  { id: 'stream', icon: faStream, keywords: 'stream logs' },
  { id: 'list', icon: faListUl, keywords: 'list' },
  { id: 'clipboard', icon: faClipboardList, keywords: 'clipboard checklist' },
  { id: 'bell', icon: faBell, keywords: 'bell alert notify' },
  { id: 'warning', icon: faExclamationTriangle, keywords: 'warning alert' },
  { id: 'error', icon: faExclamationCircle, keywords: 'error' },
  { id: 'info', icon: faInfoCircle, keywords: 'info' },
  { id: 'check', icon: faCheckCircle, keywords: 'ok success' },
  { id: 'times', icon: faTimesCircle, keywords: 'fail error' },
  { id: 'fire', icon: faFire, keywords: 'fire hot' },
  { id: 'bolt', icon: faBolt, keywords: 'bolt lightning' },
  { id: 'sync', icon: faSync, keywords: 'sync refresh' },
  { id: 'rocket', icon: faRocket, keywords: 'rocket deploy' },

  // Time & history
  { id: 'clock', icon: faClock, keywords: 'clock time' },
  { id: 'calendar', icon: faCalendarAlt, keywords: 'calendar date' },
  { id: 'history', icon: faHistory, keywords: 'history' },

  // Security & users
  { id: 'key', icon: faKey, keywords: 'key auth' },
  { id: 'lock', icon: faLock, keywords: 'lock secure' },
  { id: 'unlock', icon: faUnlock, keywords: 'unlock' },
  { id: 'shield', icon: faShieldAlt, keywords: 'shield security' },
  { id: 'user', icon: faUser, keywords: 'user person' },
  { id: 'users', icon: faUsers, keywords: 'users team' },
  { id: 'user-shield', icon: faUserShield, keywords: 'admin security' },
  { id: 'user-cog', icon: faUserCog, keywords: 'user settings' },

  // Business & places
  { id: 'building', icon: faBuilding, keywords: 'building office' },
  { id: 'home', icon: faHome, keywords: 'home' },
  { id: 'map-marker', icon: faMapMarkerAlt, keywords: 'location map' },
  { id: 'truck', icon: faTruck, keywords: 'truck logistics' },
  { id: 'shipping', icon: faShippingFast, keywords: 'shipping delivery' },
  { id: 'store', icon: faStore, keywords: 'store shop' },
  { id: 'cart', icon: faShoppingCart, keywords: 'cart shop' },
  { id: 'credit-card', icon: faCreditCard, keywords: 'payment card' },
  { id: 'wallet', icon: faWallet, keywords: 'wallet money' },
  { id: 'coins', icon: faCoins, keywords: 'coins money' },

  // Communication & media
  { id: 'envelope', icon: faEnvelope, keywords: 'email mail' },
  { id: 'comments', icon: faComments, keywords: 'chat comments' },
  { id: 'book', icon: faBook, keywords: 'book docs' },
  { id: 'book-open', icon: faBookOpen, keywords: 'docs manual' },
  { id: 'newspaper', icon: faNewspaper, keywords: 'news' },
  { id: 'image', icon: faImage, keywords: 'image picture' },
  { id: 'camera', icon: faCamera, keywords: 'camera photo' },
  { id: 'print', icon: faPrint, keywords: 'print' },
  { id: 'music', icon: faMusic, keywords: 'music audio' },
  { id: 'gamepad', icon: faGamepad, keywords: 'game' },
  { id: 'dice', icon: faDice, keywords: 'dice random' },

  // Markers & nature accents
  { id: 'star', icon: faStar, keywords: 'star favorite' },
  { id: 'heart', icon: faHeart, keywords: 'heart' },
  { id: 'flag', icon: faFlag, keywords: 'flag' },
  { id: 'thumbtack', icon: faThumbtack, keywords: 'pin thumbtack' },
  { id: 'lightbulb', icon: faLightbulb, keywords: 'idea light' },
  { id: 'moon', icon: faMoon, keywords: 'moon dark' },
  { id: 'sun', icon: faSun, keywords: 'sun light' },
  { id: 'snowflake', icon: faSnowflake, keywords: 'snow cold' },
  { id: 'leaf', icon: faLeaf, keywords: 'leaf eco' },
  { id: 'tree', icon: faTree, keywords: 'tree' },
  { id: 'water', icon: faWater, keywords: 'water' },
  { id: 'mountain', icon: faMountain, keywords: 'mountain' },
];

const ICON_BY_ID = Object.fromEntries(DIRECTORY_ICONS.map((o) => [o.id, o.icon]));

export function getDirectoryIcon(id: string | undefined): IconDefinition | null {
  if (!id) return null;
  return ICON_BY_ID[id] ?? null;
}

export function filterDirectoryIcons(query: string): DirectoryIconOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return DIRECTORY_ICONS;
  return DIRECTORY_ICONS.filter((o) => {
    const hay = `${o.id} ${o.keywords ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export interface DirectoryColorOption {
  id: string;
  /** CSS color aligned with GitHub Primer / app theme */
  hex: string;
  label: string;
}

/** Soft Primer-inspired palette matching LogStudio accents */
export const DIRECTORY_COLORS: DirectoryColorOption[] = [
  { id: 'blue', hex: '#58a6ff', label: 'Blue' },
  { id: 'cyan', hex: '#39c5cf', label: 'Cyan' },
  { id: 'teal', hex: '#3fb950', label: 'Teal' },
  { id: 'green', hex: '#56d364', label: 'Green' },
  { id: 'yellow', hex: '#d29922', label: 'Yellow' },
  { id: 'orange', hex: '#db6d28', label: 'Orange' },
  { id: 'red', hex: '#f85149', label: 'Red' },
  { id: 'pink', hex: '#db61a2', label: 'Pink' },
  { id: 'purple', hex: '#a371f7', label: 'Purple' },
  { id: 'gray', hex: '#8b949e', label: 'Gray' },
];

const COLOR_BY_ID = Object.fromEntries(DIRECTORY_COLORS.map((c) => [c.id, c.hex]));
const COLOR_ID_BY_HEX = Object.fromEntries(
  DIRECTORY_COLORS.map((c) => [c.hex.toLowerCase(), c.id])
);

/** Normalize #RGB / #RRGGBB to lowercase #rrggbb, or null if invalid. */
export function normalizeHexColor(value: string): string | null {
  const v = value.trim();
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  return null;
}

export function getDirectoryColor(idOrHex: string | undefined): string | null {
  if (!idOrHex) return null;
  if (COLOR_BY_ID[idOrHex]) return COLOR_BY_ID[idOrHex];
  return normalizeHexColor(idOrHex);
}

/** Prefer palette id when hex matches a preset; otherwise store custom hex. */
export function resolveDirectoryColorValue(hexOrId: string): string {
  if (COLOR_BY_ID[hexOrId]) return hexOrId;
  const hex = normalizeHexColor(hexOrId);
  if (!hex) return hexOrId;
  return COLOR_ID_BY_HEX[hex] ?? hex;
}

export function isCustomDirectoryColor(value: string | undefined): boolean {
  if (!value) return false;
  if (COLOR_BY_ID[value]) return false;
  return normalizeHexColor(value) !== null;
}
