'use client';

import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePuck } from '@puckeditor/core';
import { editorConfig } from '@/src/puck/config';
import styles from './PuckEditorClient.module.css';

type Props = {
  initialData: Data;
  initialPublished: boolean;
  pageId: string;
  pageSlug: string;
  title: string;
};

type SaveState = 'ready' | 'dirty' | 'saving' | 'saved' | 'published' | 'error';
type PendingSave = { data: Data; publish: boolean };

const AUTOSAVE_DELAY_MS = 3000;

function EditorHeader({
  isPublished,
  onBack,
  onPublish,
  onSaveDraft,
  saveState,
  title,
}: {
  isPublished: boolean;
  onBack: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  saveState: SaveState;
  title: string;
}) {
  const { history } = usePuck();
  const statusLabel =
    saveState === 'dirty' || saveState === 'saving'
      ? 'Salvando…'
      : saveState === 'saved'
        ? 'Salvo'
        : saveState === 'published' || (saveState === 'ready' && isPublished)
          ? 'Publicada'
          : saveState === 'error'
            ? 'Erro ao salvar'
            : 'Rascunho';

  return (
    <header className={styles.header} data-testid="puck-editor-header">
      <div className={styles.backColumn}>
        <button className={styles.backButton} onClick={onBack} type="button">
          ← Voltar para Páginas
        </button>
      </div>
      <div className={styles.titleColumn}>
        <strong className={styles.pageTitle} title={title}>{title}</strong>
        <span aria-live="polite" className={styles.saveStatus}>{statusLabel}</span>
      </div>
      <div className={styles.actions}>
        <button
          aria-label="Desfazer"
          className={styles.secondaryButton}
          disabled={!history.hasPast}
          onClick={() => history.back()}
          title="Desfazer"
          type="button"
        >
          Desfazer
        </button>
        <button
          aria-label="Refazer"
          className={styles.secondaryButton}
          disabled={!history.hasFuture}
          onClick={() => history.forward()}
          title="Refazer"
          type="button"
        >
          Refazer
        </button>
        <button className={styles.secondaryButton} onClick={onSaveDraft} type="button">
          Salvar rascunho
        </button>
        <button className={styles.primaryButton} onClick={onPublish} type="button">
          {isPublished ? 'Publicar alterações' : 'Publicar'}
        </button>
      </div>
    </header>
  );
}

export function PuckEditorClient({
  initialData,
  initialPublished,
  pageId,
  pageSlug,
  title,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initialData);
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPublishData, setPendingPublishData] = useState<Data | null>(null);
  const revision = useRef(0);
  const saveInFlight = useRef(false);
  const queuedSave = useRef<PendingSave | null>(null);
  const hasUnsavedChanges = saveState === 'dirty' || saveState === 'saving' || saveState === 'error';

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const persist = useCallback(async (nextData: Data, publish: boolean) => {
    if (saveInFlight.current) {
      queuedSave.current = { data: nextData, publish };
      return;
    }

    saveInFlight.current = true;
    try {
      let currentSave: PendingSave | null = { data: nextData, publish };
      while (currentSave) {
        const savedRevision = revision.current;
        setSaveState('saving');
        setErrorMessage(null);

        try {
          const response = await fetch(
            `/api/pages/${encodeURIComponent(pageId)}?draft=${currentSave.publish ? 'false' : 'true'}`,
            {
              method: 'PATCH',
              credentials: 'same-origin',
              cache: 'no-store',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                _status: currentSave.publish ? 'published' : 'draft',
                puckData: currentSave.data,
              }),
            },
          );

          if (!response.ok) {
            throw new Error(`Falha ao salvar no Payload (HTTP ${response.status}).`);
          }

          if (currentSave.publish) {
            setIsPublished(true);
          }
          setSaveState(
            revision.current === savedRevision
              ? currentSave.publish
                ? 'published'
                : 'saved'
              : 'dirty',
          );
        } catch (error) {
          setSaveState('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Falha inesperada ao salvar a página.',
          );
        }

        currentSave = queuedSave.current;
        queuedSave.current = null;
      }
    } finally {
      saveInFlight.current = false;
    }
  }, [pageId]);

  function handleChange(nextData: Data) {
    revision.current += 1;
    setData(nextData);
    setSaveState('dirty');
    setErrorMessage(null);
  }

  useEffect(() => {
    if (saveState !== 'dirty') {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persist(data, false);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [data, persist, saveState]);

  const handleBack = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('Há alterações que ainda não foram salvas. Deseja sair mesmo assim?')
    ) {
      return;
    }

    router.push('/admin/collections/pages');
  }, [hasUnsavedChanges, router]);

  const pageURL = pageSlug === 'home' ? '/' : `/${encodeURIComponent(pageSlug)}`;

  return (
    <div className={styles.screen}>
      {errorMessage ? <p className={styles.errorMessage} role="alert">{errorMessage}</p> : null}
      {saveState === 'published' ? (
        <a className={styles.siteLink} href={pageURL} rel="noreferrer" target="_blank">
          Ver página no site
        </a>
      ) : null}
      {pendingPublishData ? (
        <div
          aria-labelledby="confirm-publish-title"
          aria-modal="true"
          role="dialog"
          style={{
            alignItems: 'center',
            background: 'rgb(0 0 0 / 45%)',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            position: 'fixed',
            zIndex: 1000,
          }}
        >
          <section
            style={{
              background: '#fff',
              borderRadius: '0.75rem',
              maxWidth: '28rem',
              padding: '1.5rem',
              width: 'calc(100% - 2rem)',
            }}
          >
            <h2 id="confirm-publish-title">Publicar esta página?</h2>
            <p>Ela ficará visível para qualquer pessoa que acessar o site.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPendingPublishData(null)}>
                Continuar editando
              </button>
              <button
                type="button"
                disabled={saveState === 'saving'}
                onClick={() => {
                  const nextData = pendingPublishData;
                  setPendingPublishData(null);
                  setData(nextData);
                  void persist(nextData, true);
                }}
              >
                Confirmar publicação
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <Puck
        config={editorConfig}
        data={data}
        dictionary={{
          'header-publish': 'Publicar',
          'header-undo': 'Desfazer',
          'header-redo': 'Refazer',
          'header-toggle-leftsidebar': 'Mostrar blocos',
          'header-toggle-rightsidebar': 'Mostrar opções',
          'header-toggle-menubar': 'Mostrar menu',
          'action-selectparent': 'Selecionar bloco principal',
          'action-duplicate': 'Duplicar bloco',
          'action-delete': 'Excluir bloco',
          'label-page': 'Página',
          'label-component': 'Bloco',
          'outline-empty': 'Nenhum bloco adicionado',
          'outline-item-collapse': 'Recolher',
          'outline-item-expand': 'Expandir',
          'outline-header-title': 'Estrutura da página',
          'outline-header-collapseall': 'Recolher tudo',
          'outline-item-duplicate': 'Duplicar bloco',
          'outline-item-delete': 'Excluir bloco',
          'drawer-category-collapse': 'Recolher {title}',
          'drawer-category-expand': 'Expandir {title}',
          'drawer-category-other': 'Outros',
          'canvas-noconfig': 'Este item não pode ser editado.',
          'field-readonly': 'Não pode ser alterado',
          'field-arrayitem-summary': 'Item {index}',
          'field-arrayitem-duplicate': 'Duplicar',
          'field-arrayitem-delete': 'Excluir',
          'field-external-selectdata': 'Selecionar conteúdo',
          'field-external-search': 'Buscar',
          'field-external-togglefilters': 'Mostrar filtros',
          'field-external-item': 'Conteúdo',
          'field-external-result-singular': '{count} resultado',
          'field-external-result-plural': '{count} resultados',
          'field-richtext-bold': 'Negrito',
          'field-richtext-italic': 'Itálico',
          'field-richtext-underline': 'Sublinhado',
          'field-richtext-strikethrough': 'Tachado',
          'field-richtext-blockquote': 'Citação',
          'field-richtext-code-inline': 'Código',
          'field-richtext-code-block': 'Bloco de código',
          'field-richtext-list-bullet': 'Lista com marcadores',
          'field-richtext-list-ordered': 'Lista numerada',
          'field-richtext-horizontalrule': 'Linha horizontal',
          'field-richtext-align-left': 'Alinhar à esquerda',
          'field-richtext-align-center': 'Centralizar',
          'field-richtext-align-right': 'Alinhar à direita',
          'field-richtext-align-justify': 'Justificar',
          'field-richtext-select': 'Selecionar',
          'field-richtext-headingselect-1': 'Título 1',
          'field-richtext-headingselect-2': 'Título 2',
          'field-richtext-headingselect-3': 'Título 3',
          'field-richtext-headingselect-4': 'Título 4',
          'field-richtext-headingselect-5': 'Título 5',
          'field-richtext-headingselect-6': 'Título 6',
          'field-richtext-alignselect-left': 'Esquerda',
          'field-richtext-alignselect-center': 'Centro',
          'field-richtext-alignselect-right': 'Direita',
          'field-richtext-alignselect-justify': 'Justificado',
          'field-richtext-listselect-bullet': 'Lista com marcadores',
          'field-richtext-listselect-ordered': 'Lista numerada',
          'viewport-zoom-in': 'Aumentar visualização',
          'viewport-zoom-out': 'Diminuir visualização',
          'viewport-zoom-auto': '{zoom}% (automático)',
          'viewport-toggle-menu': 'Mostrar tamanhos de tela',
          'viewport-switch': 'Visualizar em {label}',
          'viewport-switch-default': 'Escolher tamanho de tela',
          'plugin-blocks': 'Blocos',
          'plugin-outline': 'Estrutura',
          'plugin-fields': 'Opções',
          'plugin-components': 'Blocos',
          'layout-maximize': 'Ampliar',
          'layout-minimize': 'Reduzir',
          'loader-loading': 'Carregando',
        }}
        onChange={handleChange}
        onPublish={setPendingPublishData}
        overrides={{
          header: () => (
            <EditorHeader
              isPublished={isPublished}
              onBack={handleBack}
              onPublish={() => setPendingPublishData(data)}
              onSaveDraft={() => void persist(data, false)}
              saveState={saveState}
              title={title}
            />
          ),
          headerActions: () => <span />,
        }}
        height="100%"
        viewports={[
          { icon: 'Monitor', width: '100%', label: 'Computador' },
          { icon: 'Tablet', width: 768, label: 'Tablet' },
          { icon: 'Smartphone', width: 390, label: 'Celular' },
        ]}
      />
    </div>
  );
}
