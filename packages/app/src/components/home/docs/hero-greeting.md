# Hero Greeting — Saudação Dinâmica

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`  
**Seção:** `<Box className={classes.hero}>`

---

## O que faz

Exibe um cartão de boas-vindas no topo da home page com:
- A data atual formatada em PT-BR (ex.: "quarta-feira, 11 de junho")
- Uma saudação contextual baseada no horário ("Bom dia", "Boa tarde", "Boa noite")
- O **primeiro nome** do usuário autenticado (ex.: "Bom dia, Manel!")
- Fundo em gradiente usando as cores primárias do tema ativo do Backstage
- Dois círculos decorativos semi-transparentes via pseudo-elementos CSS (`::before`, `::after`)

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/core-plugin-api` | `identityApiRef`, `useApi` — para buscar o nome do usuário |
| `@material-ui/core/styles` | `makeStyles`, `useTheme` — para estilização com tema |
| `@material-ui/core/Typography`, `Box` | Estrutura JSX |

---

## Lógica de saudação

```ts
// packages/app/src/components/home/HomePage.tsx
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
```

Chamada na hora da renderização (não memoizada, atualiza se o componente remontar).

---

## Lógica de buscar o nome do usuário

```tsx
const identityApi = useApi(identityApiRef);
const [displayName, setDisplayName] = useState('');

useEffect(() => {
  identityApi.getProfileInfo().then(({ displayName: name }) => {
    setDisplayName(name ?? '');
  });
}, [identityApi]);
```

No JSX, apenas o primeiro nome é usado para evitar nomes longos:

```tsx
{displayName?.split(' ')[0] || 'bem-vindo'}
```

Se `displayName` estiver vazio (usuário guest ou perfil sem nome), exibe `"bem-vindo"` como fallback.

---

## JSX

```tsx
<Box className={classes.hero}>
  <Typography className={classes.heroGreeting}>
    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
  </Typography>
  <Typography variant="h2" className={classes.heroName}>
    {getGreeting()}, {displayName?.split(' ')[0] || 'bem-vindo'}!
  </Typography>
</Box>
```

---

## Estilos (makeStyles)

```ts
hero: {
  position: 'relative',
  overflow: 'hidden',
  // Gradiente usa as cores do tema Backstage ativo — não hardcoded
  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
  color: theme.palette.primary.contrastText,
  borderRadius: theme.shape.borderRadius * 3,
  padding: theme.spacing(5, 4, 4),
  marginBottom: theme.spacing(3),
  boxShadow: theme.shadows[2],
  // Círculo decorativo superior direito
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -100, right: -60,
    width: 340, height: 340,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  // Círculo decorativo inferior esquerdo
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -80, left: -50,
    width: 260, height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
},
heroGreeting: {
  position: 'relative',
  zIndex: 1,
  fontWeight: 400,
  fontSize: '0.8rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: theme.spacing(1),
},
heroName: {
  position: 'relative',
  zIndex: 1,
  fontWeight: 700,
  lineHeight: 1.1,
},
```

> **Por que `zIndex: 1` nos textos?** Os pseudo-elementos `::before` e `::after` ficam sobre o fluxo normal sem `zIndex` explícito — o `z-index: 1` nos textos garante que fiquem na frente dos círculos decorativos.

> **Por que `theme.palette.primary` em vez de cores fixas?** A home page adapta-se automaticamente ao tema selecionado pelo usuário no Backstage (light/dark, temas customizados), sem precisar alterar o código.

---

## Localização no arquivo

`HomePage.tsx` → função `HomePage` → primeiro bloco do `return`, logo após `<Content>`.
