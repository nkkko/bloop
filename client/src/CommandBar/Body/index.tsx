import { Dispatch, memo, SetStateAction, useCallback, useState } from 'react';
import {
  CommandBarItemType,
  CommandBarSectionType,
  CommandBarStepType,
} from '../../types/general';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import Section from './Section';

type Props = {
  sections: CommandBarSectionType[];
};

const CommandBarBody = ({ sections }: Props) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev <
          sections.reduce((prev, curr) => prev + curr.items.length, 0) - 1
            ? prev + 1
            : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0
            ? prev - 1
            : sections.reduce((prev, curr) => prev + curr.items.length, 0) - 1,
        );
      }
    },
    [sections],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="flex flex-col gap-1 flex-1 w-full p-2 overflow-auto">
      {sections.map((s) => (
        <Section
          key={s.label}
          title={s.label}
          items={s.items}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          offset={s.itemsOffset}
        />
      ))}
    </div>
  );
};

export default memo(CommandBarBody);