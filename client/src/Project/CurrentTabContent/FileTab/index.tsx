import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  forceFileToBeIndexed,
  getFileContent,
  getHoverables,
} from '../../../services/api';
import { splitPath } from '../../../utils';
import FileIcon from '../../../components/FileIcon';
import Button from '../../../components/Button';
import { EyeCutIcon, MoreHorizontalIcon } from '../../../icons';
import { FileResponse } from '../../../types/api';
import { mapRanges } from '../../../mappers/results';
import { Range } from '../../../types/results';
import CodeFull from '../../../components/Code/CodeFull';
import IpynbRenderer from '../../../components/IpynbRenderer';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import { SyncStatus, TabTypesEnum } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import { FileHighlightsContext } from '../../../context/fileHighlightsContext';
import Dropdown from '../../../components/Dropdown';
import { TabsContext } from '../../../context/tabsContext';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import ActionsDropdown from './ActionsDropdown';

type Props = {
  repoRef: string;
  path: string;
  scrollToLine?: string;
  tokenRange?: string;
  noBorder?: boolean;
  branch?: string | null;
  side: 'left' | 'right';
  handleMoveToAnotherSide: () => void;
};

const FileTab = ({
  path,
  noBorder,
  repoRef,
  scrollToLine,
  branch,
  side,
  tokenRange,
  handleMoveToAnotherSide,
}: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<FileResponse | null>(null);
  const [hoverableRanges, setHoverableRanges] = useState<
    Record<number, Range[]> | undefined
  >(undefined);
  const [indexRequested, setIndexRequested] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  const { apiUrl } = useContext(DeviceContext);
  const { refreshCurrentProjectRepos } = useContext(ProjectContext.Current);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isPending, startTransition] = useTransition();
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { focusedPanel } = useContext(TabsContext.All);
  const { fileHighlights, hoveredLines } = useContext(
    FileHighlightsContext.Values,
  );
  const highlights = useMemo(() => {
    return fileHighlights[path];
  }, [path, fileHighlights]);

  useEffect(() => {
    setIndexRequested(false);
    setIsFetched(false);
  }, [path, repoRef]);

  const refetchFile = useCallback(async () => {
    try {
      const resp = await getFileContent(repoRef, path, branch);
      if (!resp) {
        setIsFetched(true);
        return;
      }
      startTransition(() => {
        setFile(resp);
        setIsFetched(true);
      });
      // if (item.indexed) {
      const data = await getHoverables(path, repoRef, branch);
      setHoverableRanges(mapRanges(data.ranges));
      // }
    } catch (err) {
      setIsFetched(true);
    }
  }, [repoRef, path, branch]);

  useEffect(() => {
    refetchFile();
  }, [refetchFile]);

  const startEventSource = useCallback(() => {
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ev?.status_change && data.ref === repoRef) {
          if (data.ev?.status_change === SyncStatus.Done) {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            refreshCurrentProjectRepos();
            setTimeout(refetchFile, 2000);
          }
        }
      } catch {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }
    };
    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [repoRef]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const onIndexRequested = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (path) {
        setIndexRequested(true);
        await forceFileToBeIndexed(repoRef, path);
        startEventSource();
        setTimeout(() => refetchFile(), 1000);
      }
    },
    [repoRef, path],
  );

  const linesNumber = useMemo(() => {
    return file?.contents?.split(/\n(?!$)/g).length || 0;
  }, [file?.contents]);

  const handleExplain = useCallback(() => {
    openNewTab(
      {
        type: TabTypesEnum.CHAT,
        initialQuery: {
          path,
          repoRef,
          branch,
          lines: [0, linesNumber - 1],
        },
      },
      side === 'left' ? 'right' : 'left',
    );
  }, [path, repoRef, branch, linesNumber, side, openNewTab]);
  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', 'E'])) {
        handleExplain();
      } else if (checkEventKeys(e, ['cmd', ']'])) {
        handleMoveToAnotherSide();
      }
    },
    [handleExplain, handleMoveToAnotherSide],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    !file?.contents || focusedPanel !== side,
  );

  const dropdownComponentProps = useMemo(() => {
    return {
      handleExplain,
      handleMoveToAnotherSide,
    };
  }, [handleExplain, handleMoveToAnotherSide]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <FileIcon filename={path} noMargin />
          {splitPath(path).slice(-2).join('/')}
        </div>
        <Dropdown
          DropdownComponent={ActionsDropdown}
          dropdownComponentProps={dropdownComponentProps}
          dropdownPlacement="bottom-end"
          appendTo={document.body}
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
      </div>
      <div className="flex-1 h-full max-w-full pl-4 py-4 overflow-auto">
        {file?.lang === 'jupyter notebook' ? (
          <IpynbRenderer data={file.contents} />
        ) : file ? (
          <CodeFull
            code={file.contents}
            language={file.lang}
            repoRef={repoRef}
            relativePath={path}
            hoverableRanges={hoverableRanges}
            scrollToLine={scrollToLine}
            branch={branch}
            tokenRange={tokenRange}
            highlights={highlights}
            hoveredLines={hoveredLines}
            side={side}
          />
        ) : isFetched && !file ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-6">
            <div className="w-15 h-15 flex items-center justify-center rounded-xl border border-bg-divider">
              <EyeCutIcon sizeClassName="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2 items-center text-center max-w-[18.75rem]">
              <p className="body-base-b text-label-title">
                <Trans>File not indexed</Trans>
              </p>
              <p className="body-s text-label-base !leading-5">
                <Trans>
                  This might be because the file is too big or it has one of
                  bloop&apos;s excluded file types.
                </Trans>
              </p>
            </div>
            {!indexRequested ? (
              <Button size="large" variant="primary" onClick={onIndexRequested}>
                <Trans>Index</Trans>
              </Button>
            ) : (
              <div className="text-bg-main mt-6">
                <SpinLoaderContainer sizeClassName="w-8 h-8" />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(FileTab);