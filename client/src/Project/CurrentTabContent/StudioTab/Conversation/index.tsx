import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ScrollToBottom from '../../../../components/ScrollToBottom';
import { StudioContext } from '../../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../../consts/codeStudio';
import { BranchIcon, WarningSignIcon } from '../../../../icons';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import { StudioConversationMessageAuthor } from '../../../../types/general';
import { getTemplates } from '../../../../services/api';
import { StudioTemplateType } from '../../../../types/api';
import { checkEventKeys } from '../../../../utils/keyboardUtils';
import { useTemplateShortcut } from '../../../../consts/shortcuts';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { UIContext } from '../../../../context/uiContext';
import KeyHintButton from '../../../../components/Button/KeyHintButton';
import Button from '../../../../components/Button';
import GeneratedDiff from './GeneratedDiff';
import ConversationInput from './Input';
import StarterMessage from './StarterMessage';
import NoFilesMessage from './NoFilesMessage';
import ContextError from './ContextError';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
  studioData: StudioContext;
  isActiveTab: boolean;
  requestsLeft: number;
  studioId: string;
};

const generateShortcut = ['cmd', 'entr'];
const stopShortcut = ['Esc'];
const noShortcut: string[] = [];

const Conversation = ({
  side,
  studioData,
  isActiveTab,
  requestsLeft,
  studioId,
}: Props) => {
  const { t } = useTranslation();
  const scrollableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<StudioTemplateType[]>([]);
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const { setIsUpgradeRequiredPopupOpen } = useContext(
    UIContext.UpgradeRequiredPopup,
  );
  const templatesRef = useRef<HTMLButtonElement | null>(null);

  const refetchTemplates = useCallback(() => {
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    refetchTemplates();
  }, []);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      if (scrollableRef.current) {
        setIsScrollable(
          scrollableRef.current.scrollHeight >
            scrollableRef.current.clientHeight,
        );
      }
    }, 100);
  }, [studioData?.conversation]);

  const hasContextError = useMemo(() => {
    return (
      studioData.tokenCount?.per_file?.includes(null) ||
      studioData.tokenCount?.per_doc_file?.includes(null)
    );
  }, [studioData.tokenCount]);

  const isTokenLimitExceeded = useMemo(() => {
    return (studioData.tokenCount?.total || 0) < TOKEN_LIMIT;
  }, [studioData.tokenCount?.total]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, generateShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        if (
          studioData.inputValue &&
          isTokenLimitExceeded &&
          !hasContextError &&
          requestsLeft
          // && !isChangeUnsaved
        ) {
          studioData.onSubmit();
        } else if (!requestsLeft) {
          setIsUpgradeRequiredPopupOpen(true);
        }
      }
      if (checkEventKeys(e, stopShortcut) && studioData.isLoading) {
        e.preventDefault();
        e.stopPropagation();
        studioData.handleCancel();
      }
      if (checkEventKeys(e, useTemplateShortcut)) {
        templatesRef.current?.parentElement?.click();
      }
    },
    [
      studioData.inputValue,
      isTokenLimitExceeded,
      studioData.onSubmit,
      studioData.isLoading,
      studioData.handleCancel,
      requestsLeft,
    ],
  );
  useKeyboardNavigation(handleKeyEvent, !isActiveTab || isDropdownShown);

  const hasCodeBlock = useMemo(() => {
    return studioData.conversation.some(
      (m) =>
        m.author === StudioConversationMessageAuthor.ASSISTANT &&
        m.message.includes('```'),
    );
  }, [studioData.conversation]);

  const isDiffForLocalRepo = useMemo(() => {
    return studioData.diff?.chunks.find((c) => c.repo.startsWith('local//'));
  }, [studioData.diff]);

  return !studioData ? null : (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom
        className="max-w-full flex flex-col overflow-auto"
        wrapperRef={scrollableRef}
      >
        <StarterMessage />
        <NoFilesMessage studioId={studioId} />
        {studioData.conversation.map((m, i) => (
          <ConversationInput
            key={i}
            author={m.author}
            message={m.error || m.message}
            onMessageChange={studioData.onMessageChange}
            onMessageRemoved={studioData.onMessageRemoved}
            i={i}
            isTokenLimitExceeded={isTokenLimitExceeded}
            isLast={i === studioData.conversation.length - 1}
            side={side}
            templates={templates}
            isActiveTab={isActiveTab}
            setIsDropdownShown={setIsDropdownShown}
          />
        ))}
        {!!studioData.diff && (
          <GeneratedDiff
            diff={studioData.diff}
            onDiffRemoved={studioData.onDiffRemoved}
            onDiffChanged={studioData.onDiffChanged}
            applyError={studioData.isDiffApplyError}
          />
        )}
        {(studioData.isDiffApplied ||
          studioData.waitingForDiff ||
          studioData.isDiffGenFailed) && (
          <div
            className={`w-full flex items-center py-2 px-3 my-3 ${
              studioData.waitingForDiff ? 'justify-between' : 'justify-center'
            } rounded gap-3 border ${
              studioData.isDiffGenFailed
                ? 'bg-red-subtle border-red-subtle-hover text-red'
                : studioData.waitingForDiff
                ? 'bg-bg-base border-bg-border text-green'
                : 'bg-blue-subtle border-blue-subtle-hover text-blue'
            } body-s-b`}
          >
            <div className="flex gap-3 items-center">
              {studioData.isDiffGenFailed ? (
                <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
              ) : studioData.waitingForDiff ? (
                <SpinLoaderContainer
                  sizeClassName="w-3.5 h-3.5"
                  colorClassName="text-green"
                />
              ) : (
                <BranchIcon sizeClassName="w-3.5 h-3.5" />
              )}
              <Trans>
                {studioData.isDiffGenFailed
                  ? 'Diff generation failed'
                  : studioData.waitingForDiff
                  ? 'Generating diff...'
                  : 'The diff has been applied locally.'}
              </Trans>
            </div>
            {studioData.waitingForDiff && (
              <Button
                onClick={studioData.handleCancelDiff}
                variant="danger"
                size="mini"
              >
                <Trans>Cancel</Trans>
              </Button>
            )}
          </div>
        )}
        {hasContextError && <ContextError />}
        {!studioData.isLoading &&
          // !studioData.isPreviewing &&
          !studioData.waitingForDiff &&
          !studioData.diff &&
          !(
            studioData.conversation[studioData.conversation.length - 1]
              ?.author === StudioConversationMessageAuthor.USER
          ) && (
            <ConversationInput
              key={'new'}
              author={studioData.inputAuthor}
              message={studioData.inputValue}
              onMessageChange={studioData.onMessageChange}
              inputRef={inputRef}
              isTokenLimitExceeded={isTokenLimitExceeded}
              isLast
              side={side}
              templates={templates}
              setIsDropdownShown={setIsDropdownShown}
              templatesRef={templatesRef}
              isActiveTab={isActiveTab}
            />
          )}
      </ScrollToBottom>
      <div
        className={`flex items-start justify-between flex-shrink-0 w-full p-4 gap-4 border-t border-bg-border shadow-medium ${
          isScrollable ? 'bg-bg-base border-x rounded-tl-md rounded-tr-md' : ''
        }`}
      >
        <div className="flex gap-2 items-center select-none">
          <KeyHintButton
            text={t('Clear conversation')}
            shortcut={noShortcut}
            onClick={studioData.clearConversation}
          />
        </div>
        <div className="flex gap-2 items-center select-none">
          {studioData.isLoading ? (
            <KeyHintButton
              text={t('Stop generating')}
              shortcut={stopShortcut}
              onClick={studioData.handleCancel}
            />
          ) : (
            <>
              {(hasCodeBlock || studioData.diff) &&
                (studioData.isDiffApplied ||
                studioData.waitingForDiff ? null : !studioData.diff ? (
                  <KeyHintButton
                    text={t('Apply changes')}
                    shortcut={noShortcut}
                    onClick={studioData.handleApplyChanges}
                  />
                ) : (
                  <>
                    <KeyHintButton
                      text={t(isDiffForLocalRepo ? 'Cancel' : 'Close')}
                      shortcut={noShortcut}
                      onClick={() => studioData.setDiff(null)}
                    />
                    {isDiffForLocalRepo && (
                      <KeyHintButton
                        text={'Apply locally'}
                        shortcut={noShortcut}
                        onClick={studioData.handleConfirmDiff}
                      />
                    )}
                  </>
                ))}
              {!studioData.diff && (
                <KeyHintButton
                  text={t('Generate')}
                  shortcut={generateShortcut}
                  onClick={studioData.onSubmit}
                  disabled={
                    hasContextError ||
                    isTokenLimitExceeded ||
                    !studioData.inputValue ||
                    !requestsLeft
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Conversation);
