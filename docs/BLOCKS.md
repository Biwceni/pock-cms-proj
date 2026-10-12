# Blocos da Onda 1

Os blocos estão em `src/puck/blocks/`, com um arquivo por bloco. A configuração do editor e a configuração server-side do site usam os mesmos renderizadores dessa pasta. `src/puck/blocks/registry.ts` é a fonte única de verdade para nomes permitidos, schemas Zod, categorias e padrões. Os tokens visuais compartilhados estão em `puck/tokens.css`.

As propriedades são salvas em `puckData.content[].props`. Imagens usam o valor desnormalizado `{ id, url, alt, width, height }`, selecionado ou enviado pela biblioteca nativa de Mídia do Payload.

## Banner

- **type:** `Banner`
- **Categoria/rótulo:** Seções / Banner
- **Campos:** `title`, `subtitle`, `buttonLabel`, `buttonUrl`, `backgroundImage`
- **Padrões:** “Destaque sua ideia”, subtítulo demonstrativo, botão “Saiba mais” apontando a `/contato`, sem imagem.

```json
{
  "type": "Banner",
  "props": {
    "title": "Destaque sua ideia",
    "subtitle": "Uma mensagem clara para apresentar sua marca.",
    "buttonLabel": "Saiba mais",
    "buttonUrl": "/contato",
    "backgroundImage": null
  }
}
```

## CardGrid

- **type:** `CardGrid`
- **Categoria/rótulo:** Seções / Grade de cards
- **Campos:** `title`, `columns` (`2`, `3` ou `4`) e `cards` (campo de lista com `title`, `text`, `url`, `image`)
- **Padrões:** grade com três cards de exemplo, três colunas e links internos; cada card pode ter mídia opcional.

```json
{
  "type": "CardGrid",
  "props": {
    "title": "Conheça nossos destaques",
    "columns": "3",
    "cards": [
      {
        "title": "Primeiro destaque",
        "text": "Apresente um benefício de forma simples.",
        "url": "/sobre",
        "image": null
      }
    ]
  }
}
```

## Heading

- **type:** `Heading`
- **Categoria/rótulo:** Básicos / Título
- **Campos:** `text`, `level` (`h1`, `h2`, `h3`)
- **Padrão:** “Título da seção”, nível `h2`.

```json
{ "type": "Heading", "props": { "text": "Sobre nós", "level": "h2" } }
```

## Text

- **type:** `Text`
- **Categoria/rótulo:** Básicos / Texto
- **Campos:** `text`, `align` (`left`, `center`, `right`)
- **Padrão:** texto demonstrativo, alinhado à esquerda.

```json
{ "type": "Text", "props": { "text": "Conteúdo da página.", "align": "left" } }
```

## Image

- **type:** `Image`
- **Categoria/rótulo:** Básicos / Imagem
- **Campos:** `image` (MediaPicker), `caption`
- **Padrão:** sem imagem e sem legenda.

```json
{
  "type": "Image",
  "props": {
    "image": {
      "id": 24,
      "url": "/media/paisagem.png",
      "alt": "Paisagem ao entardecer",
      "width": 1200,
      "height": 800
    },
    "caption": "Paisagem ao entardecer"
  }
}
```

## Button

- **type:** `Button`
- **Categoria/rótulo:** Básicos / Botão
- **Campos:** `label`, `url`, `style` (`primário`, `secundário`)
- **Padrão:** “Saiba mais”, `/contato`, estilo primário.

```json
{ "type": "Button", "props": { "label": "Fale conosco", "url": "mailto:oi@example.test", "style": "primário" } }
```

## Spacer

- **type:** `Spacer`
- **Categoria/rótulo:** Básicos / Espaçador
- **Campos:** `size` (`pequeno`, `médio`, `grande`)
- **Padrão:** espaçamento médio.

```json
{ "type": "Spacer", "props": { "size": "médio" } }
```

## Regras de segurança e renderização

- Links aceitam caminhos relativos, `http:`, `https:`, `mailto:` e `tel:`. Outros esquemas, incluindo `javascript:` e `data:`, não passam na validação do servidor. O render também sanitiza o valor antes de criar um link.
- Imagens aceitam caminhos locais absolutos e URLs `http(s)` válidas; esquemas `data:`, URLs protocol-relative e credenciais embutidas são rejeitadas na validação e ignoradas no render.
- As imagens usam `next/image` com dimensões persistidas na mídia e `unoptimized`, pois os uploads do Payload podem estar em origem/CDN variável. Isso mantém o componente e as dimensões acessíveis sem depender de allowlist de host no otimizador.
- O `MediaPicker` lista `media` pela REST API nativa e faz upload multipart para `/api/media`; o acesso de criação continua sujeito ao controle de acesso da coleção no Payload.
