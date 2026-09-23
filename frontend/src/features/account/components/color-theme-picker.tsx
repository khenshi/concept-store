'use client';

import { useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import type { ColorTheme } from '@/features/auth/model/auth.types';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';

const themes: { value: ColorTheme; label: string; mode: 'Light' | 'Dark' }[] = [
  { value: 'GRAPHITE', label: 'Graphite', mode: 'Light' },
  { value: 'OCEAN', label: 'Ocean', mode: 'Light' },
  { value: 'FOREST', label: 'Forest', mode: 'Light' },
  { value: 'PLUM', label: 'Plum', mode: 'Light' },
  { value: 'STAR_ADMIN_LIGHT', label: 'Star Admin', mode: 'Light' },
  { value: 'SYPHER_LIGHT', label: 'Sypher', mode: 'Light' },
  { value: 'CREXTIO_WARM', label: 'Crextio', mode: 'Light' },
  { value: 'SBB_INDUSTRIAL', label: 'SBB', mode: 'Light' },
  { value: 'WELLNESS_TEAL', label: 'Wellness Teal', mode: 'Light' },
  { value: 'STELLAR_DARK', label: 'Stellar', mode: 'Dark' },
  { value: 'CORONA_DARK', label: 'Corona', mode: 'Dark' },
  { value: 'JUSTDO_DARK', label: 'JustDo', mode: 'Dark' },
];

function getPickerTheme(theme: ColorTheme): ColorTheme {
  if (
    ['POLLUX_LIGHT', 'AZIA_LIGHT', 'PURPLE_LIGHT', 'BREEZE_LIGHT'].includes(
      theme,
    )
  )
    return 'PLUM';
  if (['SKYDASH_LIGHT', 'PLUS_ADMIN_LIGHT'].includes(theme)) return 'OCEAN';
  return theme;
}

export function ColorThemePicker() {
  const { user, colorTheme, updateColorTheme } = useAuth();
  const selectedTheme = getPickerTheme(colorTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function selectTheme(nextTheme: ColorTheme) {
    if (isSaving || nextTheme === colorTheme) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateColorTheme(nextTheme);
      setMessage('Your color theme has been saved.');
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your color theme could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OperationalPanel
      variant="open"
      title="Appearance"
      description="Choose a color theme for your signed-in workspace. Your choice follows your account across devices."
    >
      <fieldset className="py-5 sm:py-6" aria-busy={isSaving}>
        <legend className="text-label mb-4 font-semibold text-ink">
          Color theme
        </legend>
        {(['Light', 'Dark'] as const).map((mode) => (
          <div key={mode} className="mb-5">
            <h3 className="mb-3 text-sm font-semibold text-muted">{mode}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {themes
                .filter((theme) => theme.mode === mode)
                .map((theme) => (
                  <label
                    key={theme.value}
                    className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-control border p-3 text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${selectedTheme === theme.value ? 'border-selected-border bg-selected text-ink' : 'border-control-border bg-surface text-ink hover:border-selected-border hover:bg-hover'}`}
                  >
                    <input
                      type="radio"
                      name="color-theme"
                      aria-label={theme.label}
                      value={theme.value}
                      checked={selectedTheme === theme.value}
                      onChange={() => void selectTheme(theme.value)}
                      disabled={isSaving}
                      className="sr-only"
                    />
                    <span
                      data-color-theme={theme.value}
                      aria-hidden="true"
                      className="flex h-12 w-16 shrink-0 items-center rounded-compact bg-canvas p-1.5"
                    >
                      <span className="flex h-full w-full flex-col justify-between rounded-[0.25rem] bg-surface p-1">
                        <span className="h-1 w-2/3 rounded-full bg-ink" />
                        <span className="h-2 w-1/2 rounded-full bg-action" />
                      </span>
                    </span>
                    <span>
                      {theme.label}
                      <span className="block text-xs text-muted">
                        {theme.mode}
                      </span>
                    </span>
                    {selectedTheme === theme.value ? (
                      <span className="ml-auto text-accent" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </label>
                ))}
            </div>
          </div>
        ))}
        {isSaving ? (
          <p className="mt-4 text-sm text-muted" role="status">
            Saving color theme…
          </p>
        ) : null}
        {message ? <Notice>{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </fieldset>
    </OperationalPanel>
  );
}
