import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Button from '../../../components/Button';
import {
  InfoBadgeIcon,
  MoreHorizontalIcon,
  PromptIcon,
  SplitViewIcon,
} from '../../../icons';
import Dropdown from '../../../components/Dropdown';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import { SettingSections, StudioTabType } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import { UIContext } from '../../../context/uiContext';
import TokenUsage from '../../../components/TokenUsage';
import { StudioContext, StudiosContext } from '../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';
import { openInSplitViewShortcut } from '../../../consts/shortcuts';
import ActionsDropdown from './ActionsDropdown';
import Conversation from './Conversation';

type Props = StudioTabType & {
  noBorder?: boolean;
  side: 'left' | 'right';
  tabKey: string;
  handleMoveToAnotherSide: () => void;
};

const StudioTab = ({
  noBorder,
  side,
  studioId,
  tabKey,
  handleMoveToAnotherSide,
}: Props) => {
  const { t } = useTranslation();
  const { focusedPanel } = useContext(TabsContext.All);
  const { studios } = useContext(StudiosContext);
  const { closeTab } = useContext(TabsContext.Handlers);
  const { requestsLeft, isSubscribed, hasCheckedQuota, resetAt } = useContext(
    PersonalQuotaContext.Values,
  );
  const { setSettingsSection, setSettingsOpen } = useContext(
    UIContext.Settings,
  );
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );

  const studioData: StudioContext | undefined = useMemo(
    () => studios[tabKey],
    [studios, tabKey],
  );

  const dropdownComponentProps = useMemo(() => {
    return {
      handleMoveToAnotherSide,
      studioId,
      projectId: project?.id,
      tabKey,
      closeTab,
      refreshCurrentProjectStudios,
      side,
      clearConversation: studioData?.clearConversation,
    };
  }, [
    handleMoveToAnotherSide,
    studioId,
    closeTab,
    project?.id,
    tabKey,
    refreshCurrentProjectStudios,
    studioData?.clearConversation,
    side,
  ]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, openInSplitViewShortcut)) {
        handleMoveToAnotherSide();
      }
    },
    [handleMoveToAnotherSide],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedPanel !== side || isLeftSidebarFocused,
  );

  useEffect(() => {
    if (focusedPanel === side) {
      setFocusedTabItems([
        {
          label: t('Open in split view'),
          Icon: SplitViewIcon,
          id: 'split_view',
          key: 'split_view',
          onClick: handleMoveToAnotherSide,
          closeOnClick: true,
          shortcut: openInSplitViewShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Move'), shortcut: ['entr'] }],
        },
      ]);
    }
  }, [focusedPanel, side, handleMoveToAnotherSide]);

  const onUpgradeClick = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
  }, []);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      {!requestsLeft && (
        <div className="w-full h-10 px-4 flex items-center justify-center gap-2 flex-shrink-0 bg-red-subtle text-red body-s-b select-none">
          <span>
            <Trans>No uses left. Uses reset at</Trans>{' '}
            {format(new Date(resetAt), 'dd/MM hh:mm')}.
          </span>
          <Button size="mini" onClick={onUpgradeClick}>
            <Trans>Upgrade</Trans>
          </Button>
        </div>
      )}
      <div className="w-full h-10 px-4 flex justify-between gap-2 items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <PromptIcon sizeClassName="w-4 h-4" />
          <span className="ellipsis">
            <Trans>Prompts</Trans>
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TokenUsage
            percent={((studioData?.tokenCount?.total || 0) / TOKEN_LIMIT) * 100}
          />
          <span className="body-mini-b text-label-base">
            <Trans
              values={{
                count: studioData?.tokenCount?.total || 0,
                total: TOKEN_LIMIT,
              }}
            >
              <span
                className={
                  (studioData?.tokenCount?.total || 0) > TOKEN_LIMIT
                    ? 'text-bg-danger'
                    : ''
                }
              >
                #
              </span>{' '}
              of # tokens
            </Trans>
          </span>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          {hasCheckedQuota && !isSubscribed && (
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 body-mini text-label-muted">
                <span>
                  {requestsLeft} <Trans count={requestsLeft}>uses left</Trans>
                </span>
                <InfoBadgeIcon sizeClassName="w-3.5 h-3.5" />
              </div>
              <Button size="mini" onClick={onUpgradeClick}>
                <Trans>Upgrade</Trans>
              </Button>
            </div>
          )}
          {focusedPanel === side && (
            <Dropdown
              DropdownComponent={ActionsDropdown}
              dropdownComponentProps={dropdownComponentProps}
              appendTo={document.body}
              dropdownPlacement="bottom-end"
            >
              <Button
                variant="tertiary"
                size="mini"
                onlyIcon
                title={t('More actions')}
              >
                <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
              </Button>
            </Dropdown>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-full px-4 overflow-auto">
        {!!studioData && (
          <Conversation
            side={side}
            tabKey={tabKey}
            studioData={studioData}
            requestsLeft={requestsLeft}
            studioId={studioId}
            isActiveTab={focusedPanel === side && !isLeftSidebarFocused}
          />
        )}
      </div>
    </div>
  );
};

export default memo(StudioTab);
