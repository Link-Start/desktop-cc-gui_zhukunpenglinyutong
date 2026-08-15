use chrono::Utc;

use super::types::*;

pub(crate) fn strip_markdown_to_plain_text(markdown: &str) -> String {
    let without_images = MARKDOWN_IMAGE_REGEX.replace_all(markdown, "$1");
    let without_links = MARKDOWN_LINK_REGEX.replace_all(&without_images, "$1");
    let without_prefix = MARKDOWN_PREFIX_REGEX.replace_all(&without_links, "");
    MULTISPACE_REGEX
        .replace_all(
            &without_prefix
                .replace("```", " ")
                .replace('`', " ")
                .replace('*', " ")
                .replace('_', " ")
                .replace('~', " "),
            " ",
        )
        .trim()
        .to_string()
}

pub(crate) fn clamp_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

pub(crate) fn build_plain_text_excerpt(markdown: &str) -> String {
    let plain_text = strip_markdown_to_plain_text(markdown);
    if plain_text.is_empty() {
        String::new()
    } else {
        clamp_chars(&plain_text, 180)
    }
}

pub(crate) fn resolve_note_title(explicit_title: Option<&str>, body_markdown: &str) -> String {
    if let Some(title) = explicit_title
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return clamp_chars(title, 100);
    }
    let plain_text = strip_markdown_to_plain_text(body_markdown);
    if let Some(first_line) = plain_text
        .lines()
        .map(str::trim)
        .find(|value| !value.is_empty())
    {
        return clamp_chars(first_line, 100);
    }
    format!("Note {}", Utc::now().format("%Y-%m-%d %H:%M"))
}

pub(crate) fn summarize_note(note: &WorkspaceNoteCard, archived: bool) -> WorkspaceNoteCardSummary {
    WorkspaceNoteCardSummary {
        id: note.id.clone(),
        title: note.title.clone(),
        plain_text_excerpt: note.plain_text_excerpt.clone(),
        body_markdown: note.body_markdown.clone(),
        updated_at: note.updated_at,
        created_at: note.created_at,
        archived_at: note.archived_at,
        archived,
        image_count: note.attachments.len(),
        preview_attachments: note
            .attachments
            .iter()
            .take(3)
            .map(|attachment| NoteCardPreviewAttachment {
                id: attachment.id.clone(),
                file_name: attachment.file_name.clone(),
                content_type: attachment.content_type.clone(),
                absolute_path: attachment.absolute_path.clone(),
            })
            .collect(),
    }
}
