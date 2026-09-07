from __future__ import annotations

from .curation import (
    auto_flag_episode_stats,
    build_episode_delete_plan,
    get_auto_flag_suggestions,
)
from .derive import cancel_derive_job, get_derive_job_status, start_derive_dataset_job
from .hub import (
    clear_hf_token,
    get_hf_token_status,
    get_hub_download_status,
    get_push_job_status,
    hf_my_datasets,
    hf_token_read,
    hf_token_write,
    hf_whoami,
    hub_download_start,
    hub_push_start,
    hub_push_status,
    hub_search,
    hub_search_datasets,
    mask_token,
    resolve_hf_token,
    set_hf_token,
    start_dataset_push_job,
    start_hub_download_job,
)
from .listing import (
    build_video_range_plan,
    check_dataset_quality,
    delete_dataset,
    discover_parquet_files,
    get_dataset_info,
    iter_video_file,
    list_datasets,
    list_local_datasets,
    resolve_dataset_video,
    run_quality_check,
)
from .stats import (
    cancel_episode_stats_job,
    compute_episode_stats,
    compute_stats_signature,
    get_episode_stats,
    get_episode_stats_job_status,
    start_episode_stats_recompute_job,
)
from .tags import (
    bulk_delete_episode_tags,
    bulk_set_episode_tags,
    delete_episode_tag,
    get_episode_tags,
    load_tags,
    save_tags,
    set_episode_tag,
    tags_file_path,
)


class DatasetService:
    discover_parquet_files = staticmethod(discover_parquet_files)
    list_datasets = staticmethod(list_datasets)
    get_dataset_info = staticmethod(get_dataset_info)
    resolve_dataset_video = staticmethod(resolve_dataset_video)
    build_video_range_plan = staticmethod(build_video_range_plan)
    iter_video_file = staticmethod(iter_video_file)
    delete_dataset = staticmethod(delete_dataset)
    run_quality_check = staticmethod(run_quality_check)
    list_local_datasets = staticmethod(list_local_datasets)
    check_dataset_quality = staticmethod(check_dataset_quality)

    resolve_hf_token = staticmethod(resolve_hf_token)
    mask_token = staticmethod(mask_token)
    start_dataset_push_job = staticmethod(start_dataset_push_job)
    get_push_job_status = staticmethod(get_push_job_status)
    get_hf_token_status = staticmethod(get_hf_token_status)
    set_hf_token = staticmethod(set_hf_token)
    clear_hf_token = staticmethod(clear_hf_token)
    hf_whoami = staticmethod(hf_whoami)
    hf_my_datasets = staticmethod(hf_my_datasets)
    hub_search_datasets = staticmethod(hub_search_datasets)
    start_hub_download_job = staticmethod(start_hub_download_job)
    get_hub_download_status = staticmethod(get_hub_download_status)

    tags_file_path = staticmethod(tags_file_path)
    load_tags = staticmethod(load_tags)
    save_tags = staticmethod(save_tags)
    get_episode_tags = staticmethod(get_episode_tags)
    set_episode_tag = staticmethod(set_episode_tag)
    bulk_set_episode_tags = staticmethod(bulk_set_episode_tags)
    delete_episode_tag = staticmethod(delete_episode_tag)
    bulk_delete_episode_tags = staticmethod(bulk_delete_episode_tags)

    auto_flag_episode_stats = staticmethod(auto_flag_episode_stats)
    get_auto_flag_suggestions = staticmethod(get_auto_flag_suggestions)
    build_episode_delete_plan = staticmethod(build_episode_delete_plan)

    compute_stats_signature = staticmethod(compute_stats_signature)
    compute_episode_stats = staticmethod(compute_episode_stats)
    get_episode_stats = staticmethod(get_episode_stats)
    start_episode_stats_recompute_job = staticmethod(start_episode_stats_recompute_job)
    get_episode_stats_job_status = staticmethod(get_episode_stats_job_status)
    cancel_episode_stats_job = staticmethod(cancel_episode_stats_job)

    start_derive_dataset_job = staticmethod(start_derive_dataset_job)
    get_derive_job_status = staticmethod(get_derive_job_status)
    cancel_derive_job = staticmethod(cancel_derive_job)

    hub_search = staticmethod(hub_search)
    hub_download_start = staticmethod(hub_download_start)
    hub_push_start = staticmethod(hub_push_start)
    hub_push_status = staticmethod(hub_push_status)
    hf_token_read = staticmethod(hf_token_read)
    hf_token_write = staticmethod(hf_token_write)
