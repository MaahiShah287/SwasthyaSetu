try:
    from sentence_transformers import SentenceTransformer, util as st_util
    import torch
    _model = SentenceTransformer('all-MiniLM-L6-v2')
    _ST_AVAILABLE = True
except Exception as _st_err:
    print(f"[ai_similarity] sentence_transformers not available: {_st_err}. Similarity will return 0.0")
    _model = None
    _ST_AVAILABLE = False


def calculate_similarity(text1: str, text2: str):
    if not _ST_AVAILABLE or _model is None:
        return 0.0
    try:
        embeddings1 = _model.encode(text1, convert_to_tensor=True)
        embeddings2 = _model.encode(text2, convert_to_tensor=True)
        cosine_score = st_util.cos_sim(embeddings1, embeddings2)
        return float(cosine_score[0][0])
    except Exception as e:
        print(f"Similarity error: {e}")
        return 0.0


def get_embedding(text: str):
    if not _ST_AVAILABLE or _model is None:
        return None
    return _model.encode(text, convert_to_tensor=True)


def calculate_sim_from_embeddings(emb1, emb2):
    if not _ST_AVAILABLE or emb1 is None or emb2 is None:
        return 0.0
    cosine_score = st_util.cos_sim(emb1, emb2)
    return float(cosine_score[0][0])
