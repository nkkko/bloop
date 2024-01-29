import { Dispatch, memo, SetStateAction } from 'react';
import {
  CommandBarItemCustomType,
  CommandBarItemGeneralType,
} from '../../types/general';
import SectionDivider from './SectionDivider';
import Item from './Item';

type Props = {
  title?: string;
  items: (CommandBarItemCustomType | CommandBarItemGeneralType)[];
  focusedIndex: string;
  setFocusedIndex: Dispatch<SetStateAction<string>>;
  disableKeyNav?: boolean;
  index: string;
};

const CommandBarBodySection = ({
  title,
  items,
  setFocusedIndex,
  focusedIndex,
  disableKeyNav,
  index,
}: Props) => {
  return (
    <div className="flex flex-col select-none">
      {!!title && <SectionDivider text={title} />}
      {items.map(({ key, ...Rest }, i) =>
        'Component' in Rest ? (
          <Rest.Component
            {...Rest.componentProps}
            key={key}
            focusedIndex={focusedIndex}
            setFocusedIndex={setFocusedIndex}
            isFirst={i === 0}
            index={`${index}-${key}`}
            disableKeyNav={disableKeyNav}
          />
        ) : (
          <Item
            key={key}
            {...Rest}
            index={`${index}-${key}`}
            focusedIndex={focusedIndex}
            setFocusedIndex={setFocusedIndex}
            isFirst={i === 0}
            disableKeyNav={disableKeyNav}
            itemKey={key}
          />
        ),
      )}
    </div>
  );
};

export default memo(CommandBarBodySection);
