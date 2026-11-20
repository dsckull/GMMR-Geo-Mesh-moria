# Contrato PicoGK — worker opcional

## Situação

O endpoint `POST /api/geometry/jobs` com `{"objectId":"<UUID>"}` gera um arquivo `praca.picogk.job.v1`. Ele **não invoca PicoGK**. O projeto web usa geometria demonstrativa local até que um worker externo seja desenvolvido e validado.

## Entrada

```json
{
  "schema": "praca.picogk.job.v1",
  "jobId": "uuid",
  "source": {"sceneRevision": 3,"objectId": "uuid","objectKind": "fence","confidence": "unverified","evidence": []},
  "geometry": {"generatorId": "picogk:fence", "coordinateSpace": "object-local", "unit": "millimeters", "parameters": {"height_mm": 2000,"length_mm": 3500,"posts": 5}},
  "transformInEditor": {"unit": "meters", "position": [0,0,0], "rotationRadians": [0,0,0], "scale": [1,1,1]},
  "output": {"meshFormat": "stl", "destination": "external-worker-output", "conversionToGlbRequired": true},
  "state": "pending-external-worker"
}
```

## Requisitos do worker futuro

1. Validar versão, IDs, unidades, tipos de geradores e limites. Rejeitar caminhos e scripts arbitrários.
2. Usar família geométrica específica (alambrado, banco, poste) escrita em C#/.NET. Converter parâmetros mm a vetores PicoGK; não confundir com mundo em metros do editor.
3. Gerar malha STL com qualidade configurável, reportar AABB e número de triângulos. Não apresentar a topologia procedimental como se fosse reconstrução geométrica observada.
4. Converter malha para GLB em outro processo; aplicar materiais e otimização. Registrar hash SHA-256 e versão do gerador.
5. Retornar manifesto `{jobId,assetHash,bboxMm,files,workerVersion,status,log}` e verificar dimensões contra os parâmetros originais.
6. **Sem GPU obrigatória:** o worker pode operar por CPU; dimensionar fila e tempo de execução.

## Por que o worker é externo?

PicoGK usa C# e runtime nativo C++/OpenVDB. O NuGet oficial documenta Windows 64-bit e macOS Apple Silicon; Linux exige compilação específica fora do suporte oficial. Não se deve fazer a versão web falhar na inicialização por causa disso.

Ver: https://picogk.org/doc/setup.html e https://github.com/leap71/PicoGK
