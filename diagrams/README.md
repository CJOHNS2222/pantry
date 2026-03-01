This folder contains the inventory handling workflow (Mermaid).

To render to PNG or SVG locally using the mermaid CLI (no install required via npx):

```bash
npx @mermaid-js/mermaid-cli -i diagrams/inventory-workflow.mmd -o diagrams/inventory-workflow.png
npx @mermaid-js/mermaid-cli -i diagrams/inventory-workflow.mmd -o diagrams/inventory-workflow.svg
```

If you prefer to install the CLI locally:

```bash
npm install --save-dev @mermaid-js/mermaid-cli
npx mmdc -i diagrams/inventory-workflow.mmd -o diagrams/inventory-workflow.png
```

Let me know if you want me to run the conversion here and save the PNG/SVG in the repo.