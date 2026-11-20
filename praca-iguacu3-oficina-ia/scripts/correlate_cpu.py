#!/usr/bin/env python3
"""ORB+RANSAC CPU: detecta pares possivelmente sobrepostos; não triangula nem mede em metros.
Uso: python scripts/correlate_cpu.py data/manifest_for_orb.json data/correlations.json
"""
import json,sys,os
import cv2
import numpy as np

def run(manifest):
    root=manifest['root']; photos=manifest['photos']
    orb=cv2.ORB_create(nfeatures=1800,scaleFactor=1.2,nlevels=8,fastThreshold=15)
    features=[]
    for p in photos:
        src=cv2.imread(os.path.join(root,p['file']),cv2.IMREAD_GRAYSCALE)
        if src is None:
            features.append(([],None));continue
        h,w=src.shape
        if max(h,w)>1400:
            f=1400/max(h,w);src=cv2.resize(src,None,fx=f,fy=f,interpolation=cv2.INTER_AREA)
        kp,desc=orb.detectAndCompute(src,None)
        features.append((kp,desc))
    match=cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs=[]
    for i in range(len(photos)):
        for j in range(i+1,len(photos)):
            k1,d1=features[i];k2,d2=features[j]
            if d1 is None or d2 is None or len(d1)<8 or len(d2)<8:continue
            knn=match.knnMatch(d1,d2,k=2)
            good=[m for m,n in knn if m.distance<.76*n.distance]
            if len(good)<8:continue
            pts1=np.float32([k1[m.queryIdx].pt for m in good]).reshape(-1,1,2)
            pts2=np.float32([k2[m.trainIdx].pt for m in good]).reshape(-1,1,2)
            H,inlierMask=cv2.findHomography(pts1,pts2,cv2.RANSAC,4.0)
            inliers=int(np.sum(inlierMask)) if inlierMask is not None else 0
            ratio=inliers/max(1,len(good))
            verified=bool(inliers>=18 and ratio>=.42)
            pairs.append({'a':photos[i]['id'],'b':photos[j]['id'],'score':round(100*min(1,inliers/70)*ratio),
                'method':'ORB-RANSAC-homography','matches':len(good),'inliers':inliers,'inlierRatio':round(ratio,3),
                'homography':H.tolist() if H is not None else None,'registered':verified,
                'notes':'Verificação de sobreposição aproximada por homografia. Não comprova escala ou pose 3D.'})
    return {'method':'ORB-RANSAC','pairs':sorted(pairs,key=lambda x:x['score'],reverse=True)[:500],
        'warning':'Homografia é aproximação planar; reprojeção/triangulação/escala métricas não são calculadas.'}

if __name__=='__main__':
    if len(sys.argv)!=3:sys.exit('Uso: correlate_cpu.py <manifest.json> <output.json>')
    with open(sys.argv[1]) as f:manifest=json.load(f)
    result=run(manifest)
    with open(sys.argv[2],'w') as f:json.dump(result,f,indent=2)
    print(json.dumps({'pairs':len(result['pairs']),'registered':sum(x['registered'] for x in result['pairs'])}))
