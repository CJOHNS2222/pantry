import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// for Vitest: extend expect with testing-library matchers
expect.extend(matchers);