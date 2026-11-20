#!/usr/bin/env python3
"""Teste sintético reprodutível CPU (não substitui imagens reais)."""
import cv2,numpy as np,json,tempfile,pathlib,subprocess,sys
rng=np.random.default_rng(20261119)
with tempfile.TemporaryDirectory(prefix='praca-orb-test-') as folder:
 p=pathlib.Path(folder)
 img=np.full((600,900,3),(120,145,170),np.uint8)
 for _ in range(150):
  x,y=rng.integers(20,880),rng.integers(20,580)
  cv2.circle(img,(int(x),int(y)),int(rng.integers(3,10)),tuple(int(v) for v in rng.integers(20,245,3)),-1)
 other=cv2.warpAffine(img,np.float32([[1,0,27],[0,1,13]]),(900,600))
 unrelated=np.full_like(img,(10,10,10))
 for i,v in enumerate([img,other,unrelated]):cv2.imwrite(str(p/f'{i}.jpg'),v)
 manifest={'root':str(p),'photos':[{'id':str(i),'file':f'{i}.jpg'} for i in range(3)]}
 (p/'manifest.json').write_text(json.dumps(manifest))
 cmd=[sys.executable,str(pathlib.Path(__file__).with_name('correlate_cpu.py')),str(p/'manifest.json'),str(p/'result.json')]
 subprocess.run(cmd,check=True)
 data=json.loads((p/'result.json').read_text())
 assert any({x['a'],x['b']}=={'0','1'} and x['registered'] for x in data['pairs']),data
 assert not any('2' in {x['a'],x['b']} and x['registered'] for x in data['pairs']),data
 print('OK: par deslocado registrado, imagem sem relação descartada; nenhuma escala métrica inferida.')
