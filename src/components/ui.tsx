import { cn } from '../lib/utils';
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useVisualViewport } from '../hooks/useVisualViewport';

function scrollFieldIntoView(element: HTMLElement) {
  requestAnimationFrame(() => {
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/60',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const variants = {
    primary:
      'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 active:scale-[0.98]',
    secondary:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]',
    ghost: 'text-slate-600 hover:bg-slate-100 active:scale-[0.98]',
    danger:
      'bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 active:scale-[0.98]',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className,
  onFocus,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        data-allow-typing
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100',
          className,
        )}
        onFocus={(event) => {
          scrollFieldIntoView(event.currentTarget);
          onFocus?.(event);
        }}
        {...props}
      />
    </label>
  );
}

type SelectItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  group?: string;
};

function collectSelectItems(children: ReactNode): SelectItem[] {
  const items: SelectItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const type = child.type as unknown;

    if (type === 'optgroup') {
      const groupProps = child.props as {
        label?: string;
        children?: ReactNode;
        disabled?: boolean;
      };
      const groupLabel = groupProps.label ?? '';
      Children.forEach(groupProps.children, (inner) => {
        if (!isValidElement(inner) || (inner.type as unknown) !== 'option') return;
        const optionProps = inner.props as {
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
        };
        items.push({
          value: String(optionProps.value ?? ''),
          label: optionProps.children,
          disabled: Boolean(optionProps.disabled) || Boolean(groupProps.disabled),
          group: groupLabel,
        });
      });
      return;
    }

    if (type === 'option') {
      const optionProps = child.props as {
        value?: string;
        children?: ReactNode;
        disabled?: boolean;
      };
      items.push({
        value: String(optionProps.value ?? ''),
        label: optionProps.children,
        disabled: Boolean(optionProps.disabled),
      });
    }
  });

  return items;
}

function optionLabelText(label: ReactNode) {
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  return '';
}

export function Select({
  label,
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  name,
  id,
  placeholder,
  searchable = true,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: {
    target: { value: string; name?: string };
    currentTarget: { value: string; name?: string };
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  placeholder?: string;
  searchable?: boolean;
}) {
  const items = useMemo(() => collectSelectItems(children), [children]);

  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? items.find((item) => !item.disabled)?.value ?? '',
  );
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const lastToggleAtRef = useRef(0);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const haystack = `${optionLabelText(item.label)} ${item.group ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query]);
  const activeItem = items.find((item) => item.value === currentValue);
  const displayText: ReactNode = activeItem
    ? activeItem.label
    : placeholder ?? 'Select…';

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(200, Math.min(360, openUp ? spaceAbove - 12 : spaceBelow - 12));
    setMenuRect({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const activeEl = menuRef.current.querySelector<HTMLElement>('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [open, query]);

  function commit(nextValue: string) {
    if (!isControlled) setUncontrolledValue(nextValue);
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  const labelId = id ? `${id}-label` : undefined;

  return (
    <div className="block">
      <div
        id={labelId}
        className="mb-1.5 block cursor-default text-sm font-medium text-slate-700"
        onClick={() => {
          if (disabled) return;
          buttonRef.current?.focus();
        }}
      >
        {label}
      </div>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-labelledby={labelId}
        disabled={disabled}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          if (disabled) return;
          const now = event.timeStamp || Date.now();
          if (now - lastToggleAtRef.current < 150) return;
          lastToggleAtRef.current = now;
          setOpen((prev) => !prev);
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60',
          open && 'border-indigo-400 bg-white ring-2 ring-indigo-100',
          className,
        )}
      >
        <span
          className={cn(
            'flex-1 truncate',
            !activeItem && 'text-slate-400',
          )}
        >
          {displayText}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'shrink-0 text-slate-500 transition-transform',
            open && 'rotate-180',
          )}
        >
          <polyline points="6 8 10 12 14 8" />
        </svg>
      </button>

      {open && menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[300] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-900/10"
            style={{
              top: menuRect.openUp
                ? Math.max(8, menuRect.top - menuRect.maxHeight - 4)
                : menuRect.top + 4,
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: menuRect.maxHeight,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {searchable && (
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
                <input
                  ref={searchRef}
                  data-allow-typing
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const first = filteredItems.find((item) => !item.disabled);
                    if (first) commit(first.value);
                  }}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}
            {items.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No options</p>
            ) : filteredItems.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No matches</p>
            ) : (
              (() => {
                const rendered: ReactElement[] = [];
                let lastGroup: string | undefined;
                filteredItems.forEach((item, index) => {
                  if (item.group && item.group !== lastGroup) {
                    lastGroup = item.group;
                    rendered.push(
                      <p
                        key={`group-${item.group}-${index}`}
                        className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {item.group}
                      </p>,
                    );
                  }
                  const isActive = item.value === currentValue;
                  rendered.push(
                    <button
                      key={`opt-${item.value}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive || undefined}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        commit(item.value);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition',
                        item.disabled
                          ? 'cursor-not-allowed text-slate-300'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
                        isActive && 'bg-indigo-50 font-semibold text-indigo-700',
                      )}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                        >
                          <polyline points="5 10 9 14 15 6" />
                        </svg>
                      )}
                    </button>,
                  );
                });
                return rendered;
              })()
            )}
          </div>,
          document.body,
        )}

      <input
        type="hidden"
        name={name}
        value={currentValue}
        aria-hidden="true"
        tabIndex={-1}
        readOnly
      />
    </div>
  );
}

export function Textarea({
  label,
  className,
  onFocus,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        data-allow-typing
        className={cn(
          'min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100',
          className,
        )}
        onFocus={(event) => {
          scrollFieldIntoView(event.currentTarget);
          onFocus?.(event);
        }}
        {...props}
      />
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'wide';
}) {
  useAndroidBackHandler(onClose, open);
  const viewport = useVisualViewport(open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed left-0 z-[100] flex w-full flex-col justify-end bg-slate-900/40 sm:inset-0 sm:justify-center sm:p-4"
      style={{ top: viewport.offsetTop, height: viewport.height }}
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-full w-full flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-2xl sm:mx-auto sm:rounded-3xl',
          size === 'wide'
            ? 'sm:max-h-[min(94dvh,960px)] sm:w-[calc(100vw-2rem)] sm:max-w-none'
            : 'sm:max-h-[min(90dvh,720px)] sm:max-w-md',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between border-b border-slate-100 pb-4',
            size === 'wide' ? 'px-5 sm:px-6' : 'px-5',
          )}
          style={{ paddingTop: 'max(16px, var(--app-safe-top, 0px))' }}
        >
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4',
            size === 'wide' ? 'px-5 sm:px-6' : 'px-5',
          )}
          style={{ paddingBottom: 'max(24px, var(--app-safe-bottom, 0px))' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TOAST_EVENT = 'app-toast';

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const next = (event as CustomEvent<string>).detail?.trim();
      if (next) setMessage(next);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[400] flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        {message}
      </div>
    </div>,
    document.body,
  );
}
