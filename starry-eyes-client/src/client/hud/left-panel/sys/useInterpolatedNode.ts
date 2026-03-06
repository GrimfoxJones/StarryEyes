import { useState, useEffect, useRef } from 'react';
import type { SubsystemNode, SystemValue } from '@starryeyes/shared';
import { useGameStore } from '../../store.ts';

// Match the server's REACTOR_TIME_CONSTANT for exponential values
const EXP_TIME_CONSTANT = 3; // seconds

function findNodeById(root: SubsystemNode, id: string): SubsystemNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function interpolateValue(
  displayValue: number,
  targetValue: number,
  frameDt: number,
  hint: SystemValue['interpolation'],
): number {
  switch (hint) {
    case 'snap':
      return targetValue;
    case 'exponential': {
      const alpha = 1 - Math.exp(-frameDt / EXP_TIME_CONSTANT);
      return displayValue + (targetValue - displayValue) * alpha;
    }
    case 'linear':
    default: {
      // Linear: traverse the gap over ~500ms (2Hz update interval)
      if (targetValue === displayValue) return targetValue;
      const rate = Math.abs(targetValue - displayValue) / 0.5;
      const step = rate * frameDt;
      const diff = targetValue - displayValue;
      return Math.abs(diff) <= step ? targetValue : displayValue + Math.sign(diff) * step;
    }
  }
}

function buildInterpolatedNode(
  display: SubsystemNode,
  target: SubsystemNode,
  frameDt: number,
): SubsystemNode {
  const values: Record<string, SystemValue> = {};
  for (const key of Object.keys(target.values)) {
    const tv = target.values[key];
    const dv = display.values[key];

    if (dv && typeof tv.value === 'number' && typeof dv.value === 'number') {
      values[key] = {
        ...tv,
        value: interpolateValue(dv.value, tv.value, frameDt, tv.interpolation),
      };
    } else {
      values[key] = tv;
    }
  }

  const children = target.children.map((child) => {
    const displayChild = display.children.find(c => c.id === child.id);
    return displayChild
      ? buildInterpolatedNode(displayChild, child, frameDt)
      : child;
  });

  return { ...target, values, children };
}

export function useInterpolatedNode(nodeId: string): SubsystemNode | null {
  const displayRef = useRef<SubsystemNode | null>(null);
  const lastFrameTime = useRef(performance.now());
  const [, setTick] = useState(0);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const now = performance.now();
      const frameDt = Math.min((now - lastFrameTime.current) / 1000, 0.1);
      lastFrameTime.current = now;

      const snap = useGameStore.getState().subsystemSnapshot;
      if (!snap) {
        displayRef.current = null;
      } else {
        const targetNode = findNodeById(snap.root, nodeId);
        if (!targetNode) {
          displayRef.current = null;
        } else if (!displayRef.current) {
          displayRef.current = targetNode;
        } else {
          displayRef.current = buildInterpolatedNode(displayRef.current, targetNode, frameDt);
        }
      }

      setTick(t => t + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [nodeId]);

  return displayRef.current;
}
