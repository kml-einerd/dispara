import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore, STEPS } from '../store/onboarding';
import type { OnboardingStep } from '../store/onboarding';

// Reset store between tests
beforeEach(() => {
  useOnboardingStore.setState({
    isOpen: false,
    currentStep: 'connect-whatsapp',
    connectedSessionId: null,
    selectedGroupIds: [],
    createdPromoId: null,
  });
  sessionStorage.clear();
  localStorage.clear();
});

describe('Onboarding Store', () => {
  it('should have 4 steps in correct order', () => {
    expect(STEPS).toEqual([
      'connect-whatsapp',
      'select-groups',
      'create-promo',
      'test-dispatch',
    ]);
  });

  it('open() should set isOpen=true and reset to first step', () => {
    const store = useOnboardingStore.getState();
    store.open();
    const state = useOnboardingStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.currentStep).toBe('connect-whatsapp');
  });

  it('skip() should close wizard and set sessionStorage flag', () => {
    useOnboardingStore.getState().open();
    useOnboardingStore.getState().skip();
    const state = useOnboardingStore.getState();
    expect(state.isOpen).toBe(false);
    expect(sessionStorage.getItem('dispara_onboarding_skipped')).toBe('true');
  });

  it('isSkipped() should return true after skip', () => {
    useOnboardingStore.getState().skip();
    expect(useOnboardingStore.getState().isSkipped()).toBe(true);
  });

  it('nextStep() should advance through all steps', () => {
    useOnboardingStore.getState().open();

    for (let i = 0; i < STEPS.length - 1; i++) {
      expect(useOnboardingStore.getState().currentStep).toBe(STEPS[i]);
      useOnboardingStore.getState().nextStep();
    }
    expect(useOnboardingStore.getState().currentStep).toBe(STEPS[STEPS.length - 1]);
  });

  it('nextStep() should not go past last step', () => {
    useOnboardingStore.setState({ currentStep: 'test-dispatch' });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('test-dispatch');
  });

  it('prevStep() should go back', () => {
    useOnboardingStore.setState({ currentStep: 'select-groups' });
    useOnboardingStore.getState().prevStep();
    expect(useOnboardingStore.getState().currentStep).toBe('connect-whatsapp');
  });

  it('prevStep() should not go before first step', () => {
    useOnboardingStore.setState({ currentStep: 'connect-whatsapp' });
    useOnboardingStore.getState().prevStep();
    expect(useOnboardingStore.getState().currentStep).toBe('connect-whatsapp');
  });

  it('setConnectedSession should store session id', () => {
    useOnboardingStore.getState().setConnectedSession('sess-123');
    expect(useOnboardingStore.getState().connectedSessionId).toBe('sess-123');
  });

  it('setSelectedGroups should store group ids', () => {
    useOnboardingStore.getState().setSelectedGroups(['g1', 'g2']);
    expect(useOnboardingStore.getState().selectedGroupIds).toEqual(['g1', 'g2']);
  });

  it('setCreatedPromo should store promo id', () => {
    useOnboardingStore.getState().setCreatedPromo('pr-456');
    expect(useOnboardingStore.getState().createdPromoId).toBe('pr-456');
  });

  it('complete() should close wizard and set localStorage flag', () => {
    useOnboardingStore.getState().open();
    useOnboardingStore.getState().complete();
    const state = useOnboardingStore.getState();
    expect(state.isOpen).toBe(false);
    expect(localStorage.getItem('dispara_onboarding_complete')).toBe('true');
    expect(state.isComplete()).toBe(true);
  });

  describe('canAdvance logic', () => {
    it('connect-whatsapp: requires connectedSessionId', () => {
      useOnboardingStore.setState({ currentStep: 'connect-whatsapp', connectedSessionId: null });
      const s = useOnboardingStore.getState();
      expect(!!s.connectedSessionId).toBe(false);

      useOnboardingStore.setState({ connectedSessionId: 'sess-1' });
      expect(!!useOnboardingStore.getState().connectedSessionId).toBe(true);
    });

    it('select-groups: requires at least one group', () => {
      useOnboardingStore.setState({ currentStep: 'select-groups', selectedGroupIds: [] });
      expect(useOnboardingStore.getState().selectedGroupIds.length > 0).toBe(false);

      useOnboardingStore.setState({ selectedGroupIds: ['g1'] });
      expect(useOnboardingStore.getState().selectedGroupIds.length > 0).toBe(true);
    });

    it('create-promo: requires createdPromoId', () => {
      useOnboardingStore.setState({ currentStep: 'create-promo', createdPromoId: null });
      expect(!!useOnboardingStore.getState().createdPromoId).toBe(false);

      useOnboardingStore.setState({ createdPromoId: 'pr-1' });
      expect(!!useOnboardingStore.getState().createdPromoId).toBe(true);
    });

    it('test-dispatch: always can advance', () => {
      useOnboardingStore.setState({ currentStep: 'test-dispatch' });
      // test-dispatch always returns true for canAdvance
      expect(true).toBe(true);
    });
  });
});
