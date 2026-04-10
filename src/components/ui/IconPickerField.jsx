import { useState, useMemo } from 'react';
import {
  FaShield, FaLock, FaKey, FaUserShield, FaFingerprint, FaEye,
  FaDatabase, FaServer, FaCloud, FaMicrochip, FaRobot, FaCode,
  FaTerminal, FaNetworkWired, FaWifi, FaGlobe,
  FaChartBar, FaChartLine, FaChartPie, FaTableCells, FaArrowTrendUp, FaArrowTrendDown,
  FaBrain, FaDna, FaFlask, FaMicroscope, FaPills, FaHospital,
  FaHeartPulse, FaSyringe, FaStethoscope, FaVirus, FaAtom,
  FaFile, FaFileLines, FaFolder, FaFolderOpen, FaClipboard,
  FaBook, FaPen, FaFileMedical, FaFileContract, FaFileWaveform,
  FaHouse, FaGear, FaBell, FaMagnifyingGlass, FaStar,
  FaHeart, FaBookmark, FaFlag, FaUsers, FaUser,
  FaUserGroup, FaUserPlus, FaUserCheck, FaUserGear,
  FaRocket, FaBolt, FaWandMagic, FaCubes, FaLayerGroup,
  FaBuilding, FaCity, FaIndustry, FaWarehouse,
  FaFlaskVial, FaSatellite, FaSatelliteDish,
  FaVial, FaVials, FaRadiation, FaBiohazard,
  FaChartSimple, FaSquarePollVertical, FaFilter,
  FaTag, FaTags, FaLink, FaShare,
  FaClockRotateLeft, FaCalendarCheck, FaCalendarDays,
  FaCircleCheck, FaCircleXmark, FaCircleInfo, FaTriangleExclamation,
  FaEnvelope, FaMessage, FaPhone, FaVideo,
  FaGears,
} from 'react-icons/fa6';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const ICON_CATEGORIES = [
  {
    label: 'Security',
    icons: [
      { key: 'FaShield',        label: 'Shield',         Icon: FaShield },
      { key: 'FaLock',          label: 'Lock',           Icon: FaLock },
      { key: 'FaKey',           label: 'Key',            Icon: FaKey },
      { key: 'FaUserShield',    label: 'User Shield',    Icon: FaUserShield },
      { key: 'FaFingerprint',   label: 'Fingerprint',    Icon: FaFingerprint },
      { key: 'FaEye',           label: 'Eye',            Icon: FaEye },
    ],
  },
  {
    label: 'Technology',
    icons: [
      { key: 'FaDatabase',      label: 'Database',       Icon: FaDatabase },
      { key: 'FaServer',        label: 'Server',         Icon: FaServer },
      { key: 'FaCloud',         label: 'Cloud',          Icon: FaCloud },
      { key: 'FaMicrochip',     label: 'Microchip',      Icon: FaMicrochip },
      { key: 'FaRobot',         label: 'Robot / AI',     Icon: FaRobot },
      { key: 'FaCode',          label: 'Code',           Icon: FaCode },
      { key: 'FaTerminal',      label: 'Terminal',       Icon: FaTerminal },
      { key: 'FaNetworkWired',  label: 'Network',        Icon: FaNetworkWired },
      { key: 'FaWifi',          label: 'Wireless',       Icon: FaWifi },
      { key: 'FaGlobe',         label: 'Global',         Icon: FaGlobe },
      { key: 'FaGears',          label: 'Gears',          Icon: FaGears },
      { key: 'FaSatellite',     label: 'Satellite',      Icon: FaSatellite },
      { key: 'FaSatelliteDish', label: 'Dish',           Icon: FaSatelliteDish },
    ],
  },
  {
    label: 'Analytics',
    icons: [
      { key: 'FaChartBar',       label: 'Bar Chart',      Icon: FaChartBar },
      { key: 'FaChartLine',      label: 'Line Chart',     Icon: FaChartLine },
      { key: 'FaChartPie',       label: 'Pie Chart',      Icon: FaChartPie },
      { key: 'FaChartSimple',    label: 'Simple Chart',   Icon: FaChartSimple },
      { key: 'FaTableCells',     label: 'Table',          Icon: FaTableCells },
      { key: 'FaSquarePollVertical', label: 'Poll',       Icon: FaSquarePollVertical },
      { key: 'FaArrowTrendUp',   label: 'Trend Up',       Icon: FaArrowTrendUp },
      { key: 'FaArrowTrendDown', label: 'Trend Down',     Icon: FaArrowTrendDown },
      { key: 'FaFilter',         label: 'Filter',         Icon: FaFilter },
    ],
  },
  {
    label: 'Medical',
    icons: [
      { key: 'FaBrain',          label: 'Brain',          Icon: FaBrain },
      { key: 'FaDna',            label: 'DNA',            Icon: FaDna },
      { key: 'FaFlask',          label: 'Flask',          Icon: FaFlask },
      { key: 'FaFlaskVial',      label: 'Flask Vial',     Icon: FaFlaskVial },
      { key: 'FaMicroscope',     label: 'Microscope',     Icon: FaMicroscope },
      { key: 'FaPills',          label: 'Pills',          Icon: FaPills },
      { key: 'FaHospital',       label: 'Hospital',       Icon: FaHospital },
      { key: 'FaHeartPulse',     label: 'Heart Pulse',    Icon: FaHeartPulse },
      { key: 'FaSyringe',        label: 'Syringe',        Icon: FaSyringe },
      { key: 'FaStethoscope',    label: 'Stethoscope',    Icon: FaStethoscope },
      { key: 'FaVirus',          label: 'Virus',          Icon: FaVirus },
      { key: 'FaAtom',           label: 'Atom',           Icon: FaAtom },
      { key: 'FaVial',           label: 'Vial',           Icon: FaVial },
      { key: 'FaVials',          label: 'Vials',          Icon: FaVials },
      { key: 'FaRadiation',      label: 'Radiation',      Icon: FaRadiation },
      { key: 'FaBiohazard',      label: 'Biohazard',      Icon: FaBiohazard },
      { key: 'FaFileMedical',    label: 'Medical File',   Icon: FaFileMedical },
      { key: 'FaFileWaveform',   label: 'Waveform',       Icon: FaFileWaveform },
    ],
  },
  {
    label: 'Documents',
    icons: [
      { key: 'FaFile',           label: 'File',           Icon: FaFile },
      { key: 'FaFileLines',      label: 'File Lines',     Icon: FaFileLines },
      { key: 'FaFolder',         label: 'Folder',         Icon: FaFolder },
      { key: 'FaFolderOpen',     label: 'Folder Open',    Icon: FaFolderOpen },
      { key: 'FaClipboard',      label: 'Clipboard',      Icon: FaClipboard },
      { key: 'FaBook',           label: 'Book',           Icon: FaBook },
      { key: 'FaPen',            label: 'Pen',            Icon: FaPen },
      { key: 'FaFileContract',   label: 'Contract',       Icon: FaFileContract },
      { key: 'FaTag',            label: 'Tag',            Icon: FaTag },
      { key: 'FaTags',           label: 'Tags',           Icon: FaTags },
    ],
  },
  {
    label: 'General',
    icons: [
      { key: 'FaHouse',          label: 'Home',           Icon: FaHouse },
      { key: 'FaGear',           label: 'Settings',       Icon: FaGear },
      { key: 'FaBell',           label: 'Bell',           Icon: FaBell },
      { key: 'FaMagnifyingGlass',label: 'Search',         Icon: FaMagnifyingGlass },
      { key: 'FaStar',           label: 'Star',           Icon: FaStar },
      { key: 'FaHeart',          label: 'Heart',          Icon: FaHeart },
      { key: 'FaBookmark',       label: 'Bookmark',       Icon: FaBookmark },
      { key: 'FaFlag',           label: 'Flag',           Icon: FaFlag },
      { key: 'FaRocket',         label: 'Rocket',         Icon: FaRocket },
      { key: 'FaBolt',           label: 'Bolt',           Icon: FaBolt },
      { key: 'FaWandMagic',      label: 'Magic',          Icon: FaWandMagic },
      { key: 'FaCubes',          label: 'Cubes',          Icon: FaCubes },
      { key: 'FaLayerGroup',         label: 'Layers',         Icon: FaLayerGroup },
      { key: 'FaLink',           label: 'Link',           Icon: FaLink },
      { key: 'FaShare',          label: 'Share',          Icon: FaShare },
      { key: 'FaClockRotateLeft',label: 'History',        Icon: FaClockRotateLeft },
      { key: 'FaCalendarDays',   label: 'Calendar',       Icon: FaCalendarDays },
      { key: 'FaCalendarCheck',  label: 'Cal. Check',     Icon: FaCalendarCheck },
      { key: 'FaCircleCheck',    label: 'Check',          Icon: FaCircleCheck },
      { key: 'FaCircleXmark',    label: 'Error',          Icon: FaCircleXmark },
      { key: 'FaCircleInfo',     label: 'Info',           Icon: FaCircleInfo },
      { key: 'FaTriangleExclamation', label: 'Warning',   Icon: FaTriangleExclamation },
    ],
  },
  {
    label: 'Users',
    icons: [
      { key: 'FaUsers',          label: 'Users',          Icon: FaUsers },
      { key: 'FaUser',           label: 'User',           Icon: FaUser },
      { key: 'FaUserGroup',      label: 'User Group',     Icon: FaUserGroup },
      { key: 'FaUserPlus',       label: 'Add User',       Icon: FaUserPlus },
      { key: 'FaUserCheck',      label: 'User Check',     Icon: FaUserCheck },
      { key: 'FaUserGear',       label: 'User Config',    Icon: FaUserGear },
      { key: 'FaEnvelope',       label: 'Email',          Icon: FaEnvelope },
      { key: 'FaMessage',        label: 'Message',        Icon: FaMessage },
      { key: 'FaPhone',          label: 'Phone',          Icon: FaPhone },
      { key: 'FaVideo',          label: 'Video',          Icon: FaVideo },
    ],
  },
  {
    label: 'Organisation',
    icons: [
      { key: 'FaBuilding',       label: 'Building',       Icon: FaBuilding },
      { key: 'FaCity',           label: 'City',           Icon: FaCity },
      { key: 'FaIndustry',       label: 'Industry',       Icon: FaIndustry },
      { key: 'FaWarehouse',      label: 'Warehouse',      Icon: FaWarehouse },
    ],
  },
];

// Flat list for "All" tab and search
const ALL_ICONS = ICON_CATEGORIES.flatMap((c) => c.icons);

export function getFA6IconComponent(key) {
  const found = ALL_ICONS.find((i) => i.key === key);
  return found ? found.Icon : null;
}

export function IconPickerField({ value, onChange, label = 'Icon' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const selectedIcon = useMemo(
    () => ALL_ICONS.find((i) => i.key === value) || null,
    [value]
  );

  const displayIcons = useMemo(() => {
    const list =
      activeCategory === 'All'
        ? ALL_ICONS
        : ICON_CATEGORIES.find((c) => c.label === activeCategory)?.icons ?? [];

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    );
  }, [activeCategory, search]);

  const handleSelect = (icon) => {
    onChange(icon.key);
    setOpen(false);
    setSearch('');
  };

  const SelectedIcon = selectedIcon?.Icon;

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-3 h-10 font-normal"
          >
            {SelectedIcon ? (
              <>
                <span className="flex items-center justify-center w-6 h-6 rounded bg-primary/10">
                  <SelectedIcon className="w-4 h-4 text-primary" />
                </span>
                <span className="text-sm">{selectedIcon.label}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Click to pick an icon…</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[520px] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-3 border-b">
            <Input
              autoFocus
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-none">
            {['All', ...ICON_CATEGORIES.map((c) => c.label)].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Icon grid */}
          <div className="p-3 max-h-72 overflow-y-auto">
            {displayIcons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No icons match &ldquo;{search}&rdquo;
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {displayIcons.map(({ key, label: iconLabel, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    title={iconLabel}
                    onClick={() => handleSelect({ key, label: iconLabel, Icon })}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 p-2 rounded-md text-xs transition-colors',
                      'hover:bg-muted cursor-pointer',
                      value === key
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="truncate w-full text-center leading-tight" style={{ fontSize: '9px' }}>
                      {iconLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {value && (
            <div className="px-3 py-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Selected: <span className="font-mono">{value}</span>
              </span>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="text-xs text-destructive hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

