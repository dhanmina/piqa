import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, type, PHOTO_ASPECT_RATIO } from '../lib/theme';
import { warmCache, type RecapPhoto } from '../lib/captureQueries';
import { NetworkImage } from './NetworkImage';
import { RecapProgressTrace } from './RecapProgressTrace';

const PHOTO_MS = 1800;
const STAT_MS = 3000;
const CLOSING_MS = 3000;
// Below a distance of two beats to a tap, a press reads as a hold: pause in place
// and resume from there on release, rather than stepping to the next slide.
const HOLD_THRESHOLD_MS = 250;
// Fewer captures than this skips the opening stat slide -- with 2-3 photos a
// "3 captures" card in front of them reads as padding, not a highlight.
const SPARSE_THRESHOLD = 4;
// A full year can be 300+ captures -- one slide per photo at PHOTO_MS would run
// ~10 minutes on autoplay and take hundreds of taps to step through by hand.
// Past this count, sample evenly across the full set instead of showing every
// photo; the opening stat card still reports the true total, not the sample size.
const MAX_PHOTO_SLIDES = 48;

type RecapSlide =
  | { kind: 'stats'; count: number; rangeLabel: string }
  | { kind: 'photo'; photo: RecapPhoto }
  | { kind: 'closing'; label: string };

function formatRange(photos: RecapPhoto[]): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const first = photos[0].capturedAt;
  const last = photos[photos.length - 1].capturedAt;
  return first === last ? fmt(first) : `${fmt(first)} - ${fmt(last)}`;
}

function sampleEvenly(photos: RecapPhoto[]): RecapPhoto[] {
  if (photos.length <= MAX_PHOTO_SLIDES) return photos;
  const indices = new Set<number>();
  for (let i = 0; i < MAX_PHOTO_SLIDES; i++) {
    indices.add(Math.round((i * (photos.length - 1)) / (MAX_PHOTO_SLIDES - 1)));
  }
  return [...indices].sort((a, b) => a - b).map((i) => photos[i]);
}

function durationFor(slide: RecapSlide): number {
  if (slide.kind === 'photo') return PHOTO_MS;
  if (slide.kind === 'stats') return STAT_MS;
  return CLOSING_MS;
}

// A quiet Stories-style viewer for the year/week's captures: tap right/left to
// step, hold to pause, a trace-segmented progress row instead of a generic
// bar. An opening stat card and a closing card stand in for the highlight-reel
// stat pile and share card a Wrapped-style recap would use -- this product has
// no sharing and no gamified chrome, so the beats stay data, not celebration.
export function RecapSlideshow({
  photos,
  kind,
  children,
}: {
  photos: RecapPhoto[];
  kind: 'week' | 'year';
  children?: ReactNode;
}) {
  const slides = useMemo<RecapSlide[]>(() => {
    if (photos.length === 0) return [];
    const built: RecapSlide[] = [];
    if (photos.length >= SPARSE_THRESHOLD) {
      built.push({ kind: 'stats', count: photos.length, rangeLabel: formatRange(photos) });
    }
    built.push(...sampleEvenly(photos).map((photo): RecapSlide => ({ kind: 'photo', photo })));
    built.push({ kind: 'closing', label: kind === 'year' ? "That's your year." : "That's your week." });
    return built;
  }, [photos, kind]);

  const [index, setIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pausedValueRef = useRef(0);
  const pressStartRef = useRef(0);

  function play(slideIndex: number, fromValue: number) {
    progressAnim.setValue(fromValue);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationFor(slides[slideIndex]) * (1 - fromValue),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && slideIndex < slides.length - 1) goTo(slideIndex + 1);
    });
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setIndex(clamped);
    play(clamped, 0);
  }

  function onPressIn() {
    pressStartRef.current = Date.now();
    progressAnim.stopAnimation((value) => {
      pausedValueRef.current = value;
    });
  }

  function onPressOut(direction: 1 | -1) {
    const held = Date.now() - pressStartRef.current >= HOLD_THRESHOLD_MS;
    if (held) play(index, pausedValueRef.current);
    else goTo(index + direction);
  }

  useEffect(() => {
    if (slides.length > 0) play(0, 0);
    // Slideshow restarts only when the slide set itself changes (new photos
    // loaded), never on every index change -- goTo/play own index transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => progressAnim.stopAnimation();
  }, [slides]);

  useEffect(() => {
    const shown = slides.filter((s): s is Extract<RecapSlide, { kind: 'photo' }> => s.kind === 'photo');
    warmCache(shown.map((s) => ({ url: s.photo.url, path: s.photo.path })));
  }, [slides]);

  if (slides.length === 0) return null;

  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <RecapProgressTrace count={slides.length} index={index} progressAnim={progressAnim} />
      {children}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: '100%',
            aspectRatio: PHOTO_ASPECT_RATIO,
            borderRadius: radius.card,
            overflow: 'hidden',
            backgroundColor: colors.surface,
          }}
        >
          <SlideContent slide={slides[index]} />
          <Pressable
            accessibilityLabel="Previous"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%' }}
            onPressIn={onPressIn}
            onPressOut={() => onPressOut(-1)}
          />
          <Pressable
            accessibilityLabel="Next"
            style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '65%' }}
            onPressIn={onPressIn}
            onPressOut={() => onPressOut(1)}
          />
        </View>
      </View>
    </View>
  );
}

function SlideContent({ slide }: { slide: RecapSlide }) {
  if (slide.kind === 'photo') {
    return (
      <NetworkImage
        testID={`recap-image-${slide.photo.path}`}
        source={{ uri: slide.photo.url }}
        cacheKey={slide.photo.path}
        style={{ flex: 1 }}
        contentFit="cover"
      />
    );
  }
  if (slide.kind === 'stats') {
    return (
      <View testID="recap-stats" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
        <Text style={{ ...type.dataHero, color: colors.textPrimary }}>{slide.count}</Text>
        <Text style={{ ...type.data, color: colors.textMuted }}>{slide.rangeLabel}</Text>
      </View>
    );
  }
  return (
    <View testID="recap-closing" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
      <Text style={{ ...type.hero, color: colors.textPrimary, textAlign: 'center' }}>{slide.label}</Text>
    </View>
  );
}
