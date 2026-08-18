# Archic Executable Quality Rubric v1.0

La rúbrica es la capa de criterio que complementa, pero no sustituye, al Quality Standard y al benchmark técnico.

## Release contract

Para llegar a cliente, un proyecto necesita simultáneamente:

- benchmark técnico por encima de su threshold y sin hard gates activos;
- último run `archic-rubric` en `CLIENT_READY` o `FLAGSHIP_READY`;
- smoke/journeys superados para el preview exacto.

El boundary de despliegue vuelve a comprobar la última rúbrica persistida antes de crear una decisión `final_approval`.

## Automatic visual review

Cuando un agente produce un `previewUrl`, Control no salta directamente a smoke. El recorrido es:

1. registrar el preview exacto;
2. crear un task `rubric` para ese deployment;
3. enrutar ese task al **worker visual central de Archic Control**, sin requerir cambios en el repositorio del proyecto;
4. el worker abre la URL pública en Chromium;
5. captura hasta cuatro páginas relevantes, siempre incluyendo la home;
6. para cada página toma evidencia desktop (1440×900) y mobile (390×844);
7. además recoge texto renderizado, headings, links, imágenes rotas, errores de consola y overflow horizontal;
8. la evidencia visual se envía a un endpoint task-scoped de Control;
9. el reviewer multimodal aplica Golden Eight + S01–S50 + G01–G10 y devuelve una revisión estructurada;
10. **Control calcula la nota**, aplica penalizaciones y persiste el run `archic-rubric`;
11. sólo `CLIENT_READY` o `FLAGSHIP_READY` desbloquean el task de smoke/journeys.

El modelo no puede aprobar un deployment por sí solo: propone scoring/evidencia estructurada; el evaluador determinista de Control aplica thresholds y el boundary final vuelve a comprobar benchmark, rúbrica y smoke.

### Repair loop

Si el report queda en `INTERNAL_ONLY` o `REJECT`, Control convierte como máximo los tres arreglos de mayor impacto en `findings` de fuente `rubric` y crea tareas de autofix acotadas. Un review posterior resuelve/cancela los findings visuales anteriores antes de crear nuevos, evitando que sobrevivan correcciones obsoletas.

El autofix sigue teniendo su safety boundary normal: contexto limitado al repositorio, sin secretos/CI/deploy/database, máximo cuatro archivos y draft PR; si la corrección es demasiado amplia, el planner puede rechazarla en vez de improvisar un rediseño general.

### Evidencia que sí observa el reviewer

- captura desktop;
- captura mobile;
- contenido realmente renderizado;
- jerarquía de headings;
- links visibles;
- imágenes rotas;
- overflow horizontal en desktop o mobile;
- errores de consola recogidos durante la captura.

### Evidencia que no debe inventar

La revisión visual no afirma haber verificado comportamiento oculto, datos de negocio externos o flujos no observados. Journeys, smoke y benchmark siguen siendo la fuente de verdad para ejecución técnica.

Las capturas se comprimen y viajan únicamente como input de la revisión; no se almacenan en `quality_runs`. Se persisten el review estructurado y el report, no los JPEG base64.

## Page Modes

Cada página declara un modo dominante:

- `Atmosphere`: construir deseo.
- `Explore`: recorrer opciones.
- `Decide`: elegir una entidad concreta.
- `Convert`: completar una acción.
- `Story`: construir significado.
- `Prove`: demostrar competencia.

Los once criterios cambian de peso según el modo.

## Scoring

- sección normal: `>= 16/20`;
- hero: `>= 17/20`;
- client-ready: `>= 80/100`;
- objetivo habitual: `>= 84/100`;
- flagship: `>= 90/100`;
- home: `>= 82/100`;
- páginas críticas: `>= 80/100`;
- mobile global: `>= 80/100`;
- señales AI Slop high: `0`.

Una puntuación nunca invalida un hard gate.

## Persistencia

No se introduce una tabla paralela. Cada revisión se guarda en `quality_runs` con:

- `source = 'archic-rubric'`;
- `standard_version = 'rubric-1.0'`;
- `raw_score` = score antes de penalizaciones;
- `final_score` = Archic Score;
- `input` = revisión estructurada del reviewer **sin capturas base64**;
- `output` = report calculado por Control.

## API

`GET /api/quality/rubric` devuelve el contrato activo. Requiere bearer `INTEGRATION_SECRET`.

`POST /api/quality/rubric` recibe una revisión externa autorizada y persiste el report calculado.

`POST /api/agents/tasks/[id]/rubric-review` es el boundary interno para el reviewer automático. Requiere el lease token del task `rubric`, no un secreto global.

Ejemplo mínimo de página dentro de `pages`:

```json
{
  "path": "/",
  "label": "Inicio",
  "mode": "Atmosphere",
  "role": "home",
  "criteria": {
    "specificity": 8.5,
    "information_architecture": 8.5,
    "art_direction": 9,
    "photography": 9,
    "typography": 8.5,
    "layout_rhythm": 8.5,
    "components_data": 8,
    "ux_conversion": 8,
    "mobile": 8.5,
    "motion": 8,
    "robustness": 8.5
  },
  "sections": [
    {
      "id": "hero",
      "label": "Hero",
      "kind": "hero",
      "scores": { "purpose": 4, "specificity": 4, "hierarchy": 4, "composition": 4, "handoff": 3 }
    }
  ],
  "mobileScore": 85,
  "mobileFindings": [],
  "slopFindings": []
}
```

El request debe incluir además los diez `hardGates` G01–G10 con evidencia, un máximo de siete `topFixes` y las referencias Golden usadas sólo a nivel de principio.

## Golden Eight

- Borgo Santandrea
- Y.CO
- Buse Agency
- Porsche
- Aman
- Hermès
- noma
- Locomotive

Las referencias justifican principios; nunca autorizan copia literal de layouts.
