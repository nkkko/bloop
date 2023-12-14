import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  ChatMessageUser,
  InputValueType,
  ParsedQueryType,
  ParsedQueryTypeEnum,
  TabTypesEnum,
} from '../../../types/general';
import { conversationsCache } from '../../../services/cache';
import { mapLoadingSteps, mapUserQuery } from '../../../mappers/conversation';
import { focusInput } from '../../../utils/domUtils';
import { ChatsContext } from '../../../context/chatsContext';
import { TabsContext } from '../../../context/tabsContext';
import { getConversation } from '../../../services/api';

type Options = {
  path: string;
  lines: [number, number];
  repoRef: string;
  branch?: string | null;
};

type Props = {
  tabKey: string;
  conversationId?: string;
  initialQuery?: Options;
  side: 'left' | 'right';
};

const ChatPersistentState = ({
  tabKey,
  side,
  initialQuery,
  conversationId,
}: Props) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { project, refreshCurrentProjectConversations } = useContext(
    ProjectContext.Current,
  );
  const { preferredAnswerSpeed } = useContext(ProjectContext.AnswerSpeed);
  const { setChats } = useContext(ChatsContext);
  const { openNewTab, updateTabTitle } = useContext(TabsContext.Handlers);

  const prevEventSource = useRef<EventSource | null>(null);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], conversation } };
    });
  }, [conversation]);

  const [selectedLines, setSelectedLines] = useState<[number, number] | null>(
    null,
  );
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], selectedLines } };
    });
  }, [selectedLines]);

  const [inputValue, setInputValue] = useState<InputValueType>({
    plain: '',
    parsed: [],
  });
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputValue } };
    });
  }, [inputValue]);

  const [submittedQuery, setSubmittedQuery] = useState<
    InputValueType & { options?: Options }
  >(
    initialQuery
      ? {
          parsed: [
            {
              type: ParsedQueryTypeEnum.TEXT,
              text: `#explain_${initialQuery.path}:${initialQuery.lines.join(
                '-',
              )}-${Date.now()}`,
            },
          ],
          plain: `#explain_${initialQuery.path}:${initialQuery.lines.join(
            '-',
          )}-${Date.now()}`,
          options: initialQuery,
        }
      : {
          parsed: [],
          plain: '',
        },
  );
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], submittedQuery } };
    });
  }, [submittedQuery]);

  const [isLoading, setLoading] = useState(false);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isLoading } };
    });
  }, [isLoading]);

  const [isDeprecatedModalOpen, setDeprecatedModalOpen] = useState(false);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isDeprecatedModalOpen } };
    });
  }, [isDeprecatedModalOpen]);

  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], hideMessagesFrom } };
    });
  }, [hideMessagesFrom]);

  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], queryIdToEdit } };
    });
  }, [queryIdToEdit]);

  const [inputImperativeValue, setInputImperativeValue] = useState<Record<
    string,
    any
  > | null>(null);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputImperativeValue } };
    });
  }, [inputImperativeValue]);

  const [threadId, setThreadId] = useState('');
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], threadId } };
    });
  }, [threadId]);

  const closeDeprecatedModal = useCallback(() => {
    setDeprecatedModalOpen(false);
  }, []);

  useEffect(() => {
    setChats((prev) => {
      return {
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          setConversation,
          setInputValue,
          setSelectedLines,
          setSubmittedQuery,
          setThreadId,
          closeDeprecatedModal,
        },
      };
    });
  }, []);

  const setInputValueImperatively = useCallback(
    (value: ParsedQueryType[] | string) => {
      setInputImperativeValue({
        type: 'paragraph',
        content:
          typeof value === 'string'
            ? [
                {
                  type: 'text',
                  text: value,
                },
              ]
            : value
                .filter((pq) =>
                  ['path', 'lang', 'text', 'repo'].includes(pq.type),
                )
                .map((pq) =>
                  pq.type === 'text'
                    ? { type: 'text', text: pq.text }
                    : {
                        type: 'mention',
                        attrs: {
                          id: pq.text,
                          display: pq.text,
                          type: pq.type,
                          isFirst: false,
                        },
                      },
                ),
      });
      focusInput();
    },
    [],
  );
  useEffect(() => {
    setChats((prev) => {
      return {
        ...prev,
        [tabKey]: { ...prev[tabKey], setInputValueImperatively },
      };
    });
  }, [setInputValueImperatively]);

  const makeSearch = useCallback(
    (query: string, options?: Options) => {
      if (!query) {
        return;
      }
      prevEventSource.current?.close();
      setInputValue({ plain: '', parsed: [] });
      setInputImperativeValue(null);
      setLoading(true);
      setQueryIdToEdit('');
      setHideMessagesFrom(null);
      const url = `${apiUrl}/projects/${project?.id}/answer${
        options ? `/explain` : ``
      }`;
      const queryParams: Record<string, string> = {
        model:
          preferredAnswerSpeed === 'normal'
            ? 'gpt-4'
            : 'gpt-3.5-turbo-finetuned',
      };
      if (threadId) {
        queryParams.thread_id = threadId;
        if (queryIdToEdit) {
          queryParams.parent_query_id = queryIdToEdit;
        }
      }
      if (options) {
        queryParams.relative_path = options.path;
        queryParams.repo_ref = options.repoRef;
        if (options.branch) {
          queryParams.branch = options.branch;
        }
        queryParams.line_start = options.lines[0].toString();
        queryParams.line_end = options.lines[1].toString();
      } else {
        queryParams.q = query;
      }
      const fullUrl = url + '?' + new URLSearchParams(queryParams).toString();
      console.log(fullUrl);
      const eventSource = new EventSource(fullUrl);
      prevEventSource.current = eventSource;
      setSelectedLines(null);
      let firstResultCame: boolean;
      let i = -1;
      eventSource.onerror = (err) => {
        console.log('SSE error', err);
        firstResultCame = false;
        i = -1;
        stopGenerating();
        setConversation((prev) => {
          const newConversation = prev.slice(0, -1);
          const lastMessage: ChatMessage = {
            author: ChatMessageAuthor.Server,
            isLoading: false,
            error: t(
              "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
            ),
            loadingSteps: [],
            queryId: '',
            responseTimestamp: new Date().toISOString(),
          };
          if (!options) {
            // setInputValue(prev[prev.length - 2]?.text || submittedQuery);
            setInputValueImperatively(
              (prev[prev.length - 2] as ChatMessageUser)?.parsedQuery ||
                prev[prev.length - 2]?.text ||
                submittedQuery.parsed,
            );
          }
          setSubmittedQuery({ plain: '', parsed: [] });
          return [...newConversation, lastMessage];
        });
      };
      let thread_id = '';
      eventSource.onmessage = (ev) => {
        console.log(ev.data);
        if (
          ev.data === '{"Err":"incompatible client"}' ||
          ev.data === '{"Err":"failed to check compatibility"}'
        ) {
          eventSource.close();
          prevEventSource.current?.close();
          if (ev.data === '{"Err":"incompatible client"}') {
            setDeprecatedModalOpen(true);
          } else {
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage: ChatMessage = {
                author: ChatMessageAuthor.Server,
                isLoading: false,
                error: t(
                  "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
                ),
                loadingSteps: [],
                queryId: '',
                responseTimestamp: new Date().toISOString(),
              };
              if (!options) {
                // setInputValue(prev[prev.length - 1]?.text || submittedQuery);
                setInputValueImperatively(
                  (prev[prev.length - 1] as ChatMessageUser)?.parsedQuery ||
                    prev[prev.length - 2]?.text ||
                    submittedQuery.parsed,
                );
              }
              setSubmittedQuery({ plain: '', parsed: [] });
              return [...newConversation, lastMessage];
            });
          }
          setLoading(false);
          return;
        }
        i++;
        if (i === 0) {
          const data = JSON.parse(ev.data);
          thread_id = data.thread_id;
          setThreadId(data.thread_id);
          return;
        }
        if (ev.data === '[DONE]') {
          eventSource.close();
          prevEventSource.current = null;
          setLoading(false);
          setConversation((prev) => {
            const newConversation = prev.slice(0, -1);
            const lastMessage = {
              ...prev.slice(-1)[0],
              isLoading: false,
            };
            return [...newConversation, lastMessage];
          });
          refreshCurrentProjectConversations();
          setTimeout(() => focusInput(), 100);
          return;
        }
        try {
          const data = JSON.parse(ev.data);
          if (data.Ok) {
            const newMessage = data.Ok;
            conversationsCache[thread_id] = undefined; // clear cache on new answer
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const messageToAdd = {
                author: ChatMessageAuthor.Server,
                isLoading: true,
                loadingSteps: mapLoadingSteps(newMessage.search_steps, t),
                text: newMessage.answer,
                conclusion: newMessage.conclusion,
                queryId: newMessage.id,
                responseTimestamp: newMessage.response_timestamp,
                explainedFile: newMessage.focused_chunk?.repo_path,
              };
              const lastMessages: ChatMessage[] =
                lastMessage?.author === ChatMessageAuthor.Server
                  ? [messageToAdd]
                  : [...prev.slice(-1), messageToAdd];
              return [...newConversation, ...lastMessages];
            });
            // workaround: sometimes we get [^summary]: before it is removed from response
            if (newMessage.answer?.length > 11 && !firstResultCame) {
              if (newMessage.focused_chunk?.repo_path) {
                openNewTab(
                  {
                    type: TabTypesEnum.FILE,
                    path: newMessage.focused_chunk.repo_path.path,
                    repoRef: newMessage.focused_chunk.repo_path.repo,
                    scrollToLine:
                      newMessage.focused_chunk.start_line > -1
                        ? `${newMessage.focused_chunk.start_line}_${newMessage.focused_chunk.end_line}`
                        : undefined,
                  },
                  side === 'left' ? 'right' : 'left',
                );
              }
              firstResultCame = true;
            }
          } else if (data.Err) {
            setConversation((prev) => {
              const lastMessageIsServer =
                prev[prev.length - 1].author === ChatMessageAuthor.Server;
              const newConversation = prev.slice(
                0,
                lastMessageIsServer ? -2 : -1,
              );
              const lastMessage: ChatMessageServer = {
                ...(lastMessageIsServer
                  ? (prev.slice(-1)[0] as ChatMessageServer)
                  : {
                      author: ChatMessageAuthor.Server,
                      loadingSteps: [],
                      queryId: '',
                      responseTimestamp: new Date().toISOString(),
                    }),
                isLoading: false,
                error:
                  data.Err === 'request failed 5 times'
                    ? t(
                        'Failed to get a response from OpenAI. Try again in a few moments.',
                      )
                    : t(
                        "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
                      ),
              };
              if (!options) {
                setInputValueImperatively(
                  (
                    prev[
                      prev.length - (lastMessageIsServer ? 2 : 1)
                    ] as ChatMessageUser
                  )?.parsedQuery ||
                    prev[prev.length - 2]?.text ||
                    submittedQuery.parsed,
                );
              }
              setSubmittedQuery({ plain: '', parsed: [] });
              return [...newConversation, lastMessage];
            });
          }
        } catch (err) {
          console.log('failed to parse response', err);
        }
      };
      return () => {
        eventSource.close();
      };
    },
    [threadId, t, queryIdToEdit, preferredAnswerSpeed, openNewTab, side],
  );

  useEffect(() => {
    if (!submittedQuery.plain) {
      return;
    }
    let userQuery = submittedQuery.plain;
    let userQueryParsed = submittedQuery.parsed;
    const options = submittedQuery.options;
    if (submittedQuery.plain.startsWith('#explain_')) {
      const [prefix, ending] = submittedQuery.plain.split(':');
      const [lineStart, lineEnd] = ending.split('-');
      const filePath = prefix.slice(9);
      userQuery = t(
        `Explain the purpose of the file {{filePath}}, from lines {{lineStart}} - {{lineEnd}}`,
        {
          lineStart: Number(lineStart) + 1,
          lineEnd: Number(lineEnd) + 1,
          filePath,
        },
      );
      userQueryParsed = [{ type: ParsedQueryTypeEnum.TEXT, text: userQuery }];
    }
    setConversation((prev) => {
      if (!prev.length) {
        updateTabTitle(tabKey, userQuery, side);
      }
      return prev.length === 1 && submittedQuery.options
        ? prev
        : [
            ...prev,
            {
              author: ChatMessageAuthor.User,
              text: userQuery,
              parsedQuery: userQueryParsed,
              isLoading: false,
            },
          ];
    });
    makeSearch(userQuery, options);
  }, [submittedQuery]);

  const stopGenerating = useCallback(() => {
    prevEventSource.current?.close();
    setLoading(false);
    setConversation((prev) => {
      const newConversation = prev.slice(0, -1);
      const lastMessage = {
        ...prev.slice(-1)[0],
        isLoading: false,
      };
      return [...newConversation, lastMessage];
    });
    setTimeout(focusInput, 100);
  }, []);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], stopGenerating } };
    });
  }, [stopGenerating]);

  const onMessageEdit = useCallback(
    (parentQueryId: string, i: number) => {
      setQueryIdToEdit(parentQueryId);
      if (isLoading) {
        stopGenerating();
      }
      setHideMessagesFrom(i);
      const mes = conversation[i] as ChatMessageUser;
      setInputValueImperatively(mes.parsedQuery || mes.text!);
    },
    [isLoading, conversation],
  );
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageEdit } };
    });
  }, [onMessageEdit]);

  const onMessageEditCancel = useCallback(() => {
    setQueryIdToEdit('');
    setInputValue({ plain: '', parsed: [] });
    setInputImperativeValue(null);
    setHideMessagesFrom(null);
  }, []);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageEditCancel } };
    });
  }, [onMessageEditCancel]);

  useEffect(() => {
    if (conversationId && project?.id) {
      getConversation(project.id, conversationId).then((resp) => {
        // todo: add thread_id
        const conv: ChatMessage[] = [];
        resp.forEach((m) => {
          // @ts-ignore
          const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
          const parsedQuery = mapUserQuery(m);
          conv.push({
            author: ChatMessageAuthor.User,
            text: m.query.raw_query || userQuery?.content?.query || '',
            parsedQuery,
            isFromHistory: true,
          });
          conv.push({
            author: ChatMessageAuthor.Server,
            isLoading: false,
            loadingSteps: mapLoadingSteps(m.search_steps, t),
            text: m.answer,
            conclusion: m.conclusion,
            queryId: m.id,
            responseTimestamp: m.response_timestamp,
            explainedFile: m.focused_chunk?.repo_path.path,
          });
        });
        setConversation(conv);
      });
    }
  }, [conversationId, project?.id]);

  return null;
};

export default memo(ChatPersistentState);