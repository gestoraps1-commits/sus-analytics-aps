---
description: Fluxo de teste local e deploy para Vercel via Git
---

Este workflow garante que as alterações sejam testadas localmente antes de serem enviadas para o Vercel.

1. **Build do Projeto**:
// turbo
```powershell
npm run build
```

2. **Testes Unitários**:
// turbo
```powershell
npm run test
```

3. **Verificação no Navegador**:
Abra o navegador em `http://localhost:8083` e verifique manualmente as alterações mais recentes.

4. **Confirmação do Usuário**:
Pergunte ao usuário: "Os testes locais passaram e a build foi concluída. Deseja realizar o deploy da nova versão para o Vercel?"

5. **Deploy via Git**:
Se o usuário confirmar, execute os comandos:
```powershell
git add .
git commit -m "feat/fix: [descrição resumida das mudanças]"
git push
```
