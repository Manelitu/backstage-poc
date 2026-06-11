# Barra de Busca

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`  
**Seção:** `<Box className={classes.searchSection}>`

---

## O que faz

Exibe uma barra de busca centralizada abaixo do hero, com:
- Largura máxima de 820px, centralizada horizontalmente
- Ícone de lupa no início do campo
- Botão × para limpar o texto enquanto há conteúdo digitado
- Fundo branco (papel) com sombra leve (`shadows[1]`) em repouso, sombra elevada (`shadows[3]`) e borda colorida ao receber foco
- Submit navega para `/search?query=<termo>` via `window.location.href`
- Bordas arredondadas (pill shape) e sem borda outline visível

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-search-react` | `SearchBarBase` — componente de input de busca |
| `@material-ui/core/InputAdornment` | Adornos de lupa e botão de limpar |
| `@material-ui/icons/Search` | Ícone de lupa |
| `@material-ui/icons/Close` | Ícone × para limpar |
| `@material-ui/core/IconButton` | Botão de limpar clicável |

---

## Estado

```ts
const [searchQuery, setSearchQuery] = useState('');
```

Controlado localmente no componente `HomePage`. O valor é sincronizado com `SearchBarBase` via `value` e `onChange`.

---

## JSX completo

```tsx
<Box className={classes.searchSection}>
  <Box className={classes.searchInner}>
    <SearchBarBase
      value={searchQuery}
      onChange={setSearchQuery}
      onSubmit={() => {
        if (searchQuery.trim())
          window.location.href = `/search?query=${encodeURIComponent(searchQuery.trim())}`;
      }}
      clearButton={false}
      placeholder="Buscar componentes, APIs, documentação..."
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        ),
        endAdornment: searchQuery ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => setSearchQuery('')}
              aria-label="limpar busca"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  </Box>
</Box>
```

> **`clearButton={false}`**: desabilita o botão de limpar nativo do `SearchBarBase` para usar o botão customizado no `endAdornment`, que só aparece quando há texto digitado.

> **`encodeURIComponent`**: garante que termos com espaços, acentos e caracteres especiais sejam codificados corretamente na URL.

---

## Estilos (makeStyles)

```ts
searchSection: {
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(3, 0, 4),
},
searchInner: {
  width: '100%',
  maxWidth: 820,
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius * 6,  // pill shape
  boxShadow: theme.shadows[1],
  transition: 'border-color 0.2s, box-shadow 0.2s',
  '&:focus-within': {
    boxShadow: theme.shadows[3],        // eleva sombra ao focar
    borderColor: theme.palette.primary.main,  // destaca borda com cor primária
  },
  '& .MuiInputBase-root': {
    borderRadius: theme.shape.borderRadius * 6,
    padding: theme.spacing(0, 1),
    fontSize: '0.95rem',
    height: 44,
  },
  // Remove a borda outline do MUI Outlined Input
  '& .MuiOutlinedInput-notchedOutline, & fieldset': {
    border: 'none',
  },
  '& .MuiInputBase-input': {
    padding: theme.spacing(0, 0.5),
  },
},
```

> **`&:focus-within`**: pseudo-classe CSS nativa que aplica estilos quando qualquer filho do container recebe foco — usada aqui para elevar a sombra e adicionar borda colorida quando o campo de texto está ativo.

> **Sombra em dois níveis**: `shadows[1]` em repouso mantém consistência visual com todos os outros cards da página; `shadows[3]` ao focar sinaliza interatividade sem sombra excessiva.

---

## Localização no arquivo

`HomePage.tsx` → função `HomePage` → segundo bloco do `return`, logo após `</Box>` do hero.
