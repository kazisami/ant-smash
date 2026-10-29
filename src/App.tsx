/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AntCanvas } from './components/AntCanvas';

export default function App() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none bg-white font-sans">
      <AntCanvas />
    </div>
  );
}
